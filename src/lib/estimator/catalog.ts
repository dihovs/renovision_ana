import { LINE_ITEMS } from "./data/lineItems";
import type { LineItem } from "./types";

const BY_CODE = new Map<string, LineItem>(LINE_ITEMS.map((it) => [it.itemCode, it]));

export function getLineItem(code: string): LineItem | undefined {
  return BY_CODE.get(code);
}

export { LINE_ITEMS };

/**
 * An item's name in the language a DOCUMENT is printed in.
 *
 * The one door for a printed devis. `fallback` is what an estimate line
 * already carries (`EstimateLine.name`, frozen at derivation time and
 * possibly hand-edited by the operator) and is used whenever the code is
 * null, unknown, or the line's name has been edited away from the book's —
 * a hand-written line must print as the operator wrote it, never silently
 * replaced by the catalog's wording for a neighbouring code.
 */
export function lineItemName(
  code: string | null | undefined,
  locale: "en" | "fr",
  fallback: string,
): string {
  if (!code) return fallback;
  const item = BY_CODE.get(code);
  if (!item) return fallback;
  if (fallback !== item.name && fallback !== item.nameFr) return fallback;
  return locale === "fr" ? item.nameFr : item.name;
}

/**
 * **The unit, as the document prints it.**
 *
 * `pi²` and `pi lin.` are what a Québec devis says; `sq ft` beside a French
 * description is the giveaway that a page was translated rather than
 * written. The vocabulary is closed (`Unit` in ./types), so this is a table
 * and not a guess — an unknown unit prints as it arrived rather than being
 * mangled.
 *
 * Two of these are judgement calls worth flagging rather than burying:
 * `load` is `voyage`, the word a Québec contractor uses for a truckload of
 * debris (Xactimate's own French prints the opaque `CH`/chaque there); and
 * `job` is `forfait`, a lump sum for the whole job, as opposed to `each`,
 * which is the reference's `CH`.
 */
const UNIT_LABEL_FR: Record<string, string> = {
  "sq ft": "pi²",
  "linear ft": "pi lin.",
  each: "ch.",
  hour: "h",
  day: "jour",
  job: "forfait",
  room: "pièce",
  load: "voyage",
  trip: "déplacement",
  visit: "visite",
  call: "appel",
  report: "rapport",
  allowance: "provision",
};

export function unitLabel(unit: string, locale: "en" | "fr"): string {
  if (locale !== "fr") return unit;
  return UNIT_LABEL_FR[unit] ?? unit;
}

/**
 * A compact, prompt-ready listing of the catalog: one line per item,
 * grouped by category, giving Claude the code, name, unit and keywords it
 * needs to select items — without the full object noise. Sales rates are
 * intentionally omitted from the prompt so the model can't be tempted to do
 * the money math itself; the backend prices every code it returns.
 */
export function buildCatalogSummary(): string {
  const byCategory = new Map<string, LineItem[]>();
  for (const it of LINE_ITEMS) {
    const list = byCategory.get(it.category) ?? [];
    list.push(it);
    byCategory.set(it.category, list);
  }

  const sections: string[] = [];
  for (const [category, items] of byCategory) {
    const lines = items.map(
      (it) =>
        `  ${it.itemCode} | ${it.name} (per ${it.unit}) — ${it.keywords}` +
        (it.exclusions ? ` [excludes: ${it.exclusions}]` : ""),
    );
    sections.push(`${category}:\n${lines.join("\n")}`);
  }
  return sections.join("\n\n");
}
