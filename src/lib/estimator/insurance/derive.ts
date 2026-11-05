// The derivation engine: run the rules over a project's measurements and
// produce estimate lines. Re-runnable without destroying hand edits
// (Estimator-Spec.md §3.1): every line carries its origin, re-running
// replaces derived lines and never touches manual ones.
//
// The composition order is fixed and matters:
//
//     applyMinimumCharges(mergeLines(previous, deriveLines(ctx)), minimums)
//
// — derive fresh, merge against what the operator has, THEN top trades up
// to their minimums, so the minimums see the estimate as it will actually
// bill (manual lines included) and never stack on their own output.

import { getLineItem } from "../catalog";
import { OBJECT_RULES, PROJECT_RULES, ROOM_RULES } from "./rules";
import { rateCents } from "./trailer";
import type { EstimateContext, EstimateLine, EstimateRoom, LineIssue, RuleLine } from "./types";
import { ESTIMATOR_STRINGS, type EstimatorStrings } from "./strings";
import type { Locale } from "@/i18n/translations";

/** The pseudo-room general conditions print under, following the reference.
    Already French in both languages, because that is what the reference
    documents print and what the owner's own devis say — `Frais généraux` is
    the section's NAME, not a translated heading. */
export const GENERAL_CONDITIONS = "Frais généraux";

/**
 * A line's key must name WHAT the line is, never where it sits in an array.
 * An ordinal re-keys every sibling the moment a rule emits one line more or
 * fewer — recording a room's floor finish, adding a dehumidifier — and a
 * re-keyed line silently orphans the operator's edit or hands it to a
 * different line's successor. The slot is the rule's keyHint, falling back
 * to the line's item code; duplicates within one derivation get a stable
 * disambiguating suffix.
 */
function lineSlot(ruleLine: RuleLine): string {
  return (
    ruleLine.keyHint ??
    ruleLine.itemCode ??
    ruleLine.removalItemCode ??
    ruleLine.label ??
    "line"
  );
}

function resolve(
  ruleId: string,
  subjectId: string,
  room: Pick<EstimateRoom, "roomScanId" | "name" | "apartment"> | null,
  ruleLine: RuleLine,
  slot: string,
  t: EstimatorStrings,
): EstimateLine {
  const issues = new Set<LineIssue>(ruleLine.issues ?? []);

  const replaceRateCents = rateCents(ruleLine.itemCode);
  if (ruleLine.itemCode && replaceRateCents === null) issues.add("no_item");
  const removeRateCents = rateCents(ruleLine.removalItemCode);
  if (ruleLine.removalItemCode && removeRateCents === null) issues.add("no_item");

  const item = ruleLine.itemCode ? getLineItem(ruleLine.itemCode) : undefined;
  const removalItem = ruleLine.removalItemCode
    ? getLineItem(ruleLine.removalItemCode)
    : undefined;
  // The book's ENGLISH name is what gets stored, deliberately: it is a
  // catalog lookup on the code, so a printed document re-localizes it at
  // render time (`lineItemName`), and the estimate builder the owner works
  // in stays in the language he works in. A rule's own `label` — for work
  // the book has no code for — has no code to look up and therefore arrives
  // already in the document's language.
  const name = ruleLine.label ?? item?.name ?? removalItem?.name ?? t.unpricedWork;

  return {
    key: `${ruleId}:${subjectId}:${slot}`,
    origin: "derived",
    provenance: "rule",
    roomScanId: room?.roomScanId ?? null,
    roomName: room?.name ?? GENERAL_CONDITIONS,
    // Inherited from the room, never asked of a rule: a rule prices work on
    // a surface and has no business knowing which door of a triplex it is
    // behind. Project-level lines (débris, nettoyage final) carry none, and
    // that is what puts them after the last apartment on the printed devis.
    apartment: room?.apartment ?? null,
    tradeSection: ruleLine.tradeSection,
    activity: ruleLine.activity,
    itemCode: ruleLine.itemCode || null,
    removalItemCode: ruleLine.removalItemCode || null,
    name,
    unit: ruleLine.unit,
    quantity: ruleLine.quantity,
    removeRateCents,
    replaceRateCents,
    calc: ruleLine.calc,
    note: ruleLine.note ?? null,
    issues: [...issues],
    // Memo and unpriced lines carry no money, so the flag is moot; priced
    // lines follow their book item, and an E&R line follows its install side.
    taxable: item?.taxable ?? removalItem?.taxable ?? true,
    removed: false,
  };
}

/** Run every rule over the context. Deterministic: same context, same rules,
    same lines with the same keys — which is what makes the merge below safe. */
export function deriveLines(ctx: EstimateContext, locale: Locale = "en"): EstimateLine[] {
  const t = ESTIMATOR_STRINGS[locale];
  const lines: EstimateLine[] = [];
  const seenKeys = new Map<string, number>();

  function push(
    ruleId: string,
    subjectId: string,
    room: Pick<EstimateRoom, "roomScanId" | "name" | "apartment"> | null,
    ruleLine: RuleLine,
  ) {
    let slot = lineSlot(ruleLine);
    const base = `${ruleId}:${subjectId}:${slot}`;
    const count = seenKeys.get(base) ?? 0;
    seenKeys.set(base, count + 1);
    if (count > 0) slot = `${slot}#${count + 1}`;
    lines.push(resolve(ruleId, subjectId, room, ruleLine, slot, t));
  }

  for (const room of ctx.rooms) {
    for (const rule of ROOM_RULES) {
      for (const ruleLine of rule.lines(room, t)) push(rule.id, room.roomScanId, room, ruleLine);
    }
    for (const object of room.objects) {
      for (const rule of OBJECT_RULES) {
        for (const ruleLine of rule.lines(object, room, t)) push(rule.id, object.id, room, ruleLine);
      }
    }
  }

  for (const rule of PROJECT_RULES) {
    for (const ruleLine of rule.lines(ctx, t)) push(rule.id, "project", null, ruleLine);
  }

  return lines;
}

/**
 * Re-run semantics (§3.1): fresh derived lines replace the previous derived
 * lines wholesale; manual lines survive in place. A derived line the
 * operator edited must arrive here with origin "manual" — that is the
 * editor's contract — and from then on the derivation never overwrites it;
 * its derived successor is dropped so the same work is not billed twice.
 * Removed tombstones are manual lines too, so a deleted derived line stays
 * deleted through every re-run.
 */
export function mergeLines(previous: EstimateLine[], fresh: EstimateLine[]): EstimateLine[] {
  const manual = previous.filter((line) => line.origin === "manual");
  const manualKeys = new Set(manual.map((line) => line.key));
  return [...manual, ...fresh.filter((line) => !manualKeys.has(line.key))];
}

/**
 * Per-trade minimum labour charges, the reference's "Coûts minimaux de
 * main-d'œuvre appliqués": when a trade appears in the estimate but its
 * work totals less than the firm's minimum, a top-up line is added so the
 * trade is billed at its floor. The minimums themselves are the owner's
 * numbers — the machinery ships first, with an empty table, exactly like
 * the rules it serves.
 *
 * Idempotent by construction: its own top-up lines carry no item codes, so
 * they never count toward a trade's billed base, and a category that
 * already has a minimum line — including one the operator edited into a
 * manual line — is never topped up again.
 */
export function applyMinimumCharges(
  lines: EstimateLine[],
  minimumsByCategory: Record<string, number>,
  locale: Locale = "en",
): EstimateLine[] {
  const t = ESTIMATOR_STRINGS[locale];
  const baseByCategory = new Map<string, number>();
  const add = (category: string | undefined, cents: number) => {
    if (!category || cents === 0) return;
    baseByCategory.set(category, (baseByCategory.get(category) ?? 0) + cents);
  };
  for (const line of lines) {
    if (line.removed) continue;
    // Each side of the line credits ITS OWN item's category: an E&R pair can
    // cross categories (DEM-CAB-LF is "Kitchen", CAB-INST-BASE is
    // "Cabinetry"), and crediting the removal money to the install trade
    // would let one trade's work quietly satisfy another trade's minimum.
    const qty100 = Math.round(line.quantity * 100);
    add(
      line.itemCode ? getLineItem(line.itemCode)?.category : undefined,
      Math.round((qty100 * (line.replaceRateCents ?? 0)) / 100),
    );
    add(
      line.removalItemCode ? getLineItem(line.removalItemCode)?.category : undefined,
      Math.round((qty100 * (line.removeRateCents ?? 0)) / 100),
    );
  }

  const existingMinimums = new Set(
    lines.filter((line) => line.key.startsWith("minimum:")).map((line) => line.key),
  );

  const minimumLines: EstimateLine[] = [];
  for (const [category, minimumCents] of Object.entries(minimumsByCategory)) {
    if (existingMinimums.has(`minimum:${category}`)) continue;
    const base = baseByCategory.get(category);
    if (base === undefined || base === 0 || base >= minimumCents) continue;
    const shortfall = minimumCents - base;
    minimumLines.push({
      key: `minimum:${category}`,
      origin: "derived",
      provenance: "rule",
      roomScanId: null,
      roomName: GENERAL_CONDITIONS,
      apartment: null,
      tradeSection: "misc",
      activity: "install",
      itemCode: null,
      removalItemCode: null,
      name: t.minimumLabourCharge(category),
      unit: "each",
      quantity: 1,
      removeRateCents: null,
      replaceRateCents: shortfall,
      calc: t.minimumCalc((minimumCents / 100).toFixed(2), (base / 100).toFixed(2)),
      note: null,
      issues: [],
      taxable: true,
      removed: false,
    });
  }
  return [...lines, ...minimumLines];
}
