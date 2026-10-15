// Our devis for SDC H1 Phase 3 (122 boul. Hymus) — the arithmetic, shared by
// the printed sample (hymus.sample.test.ts) and the report render
// (src/components/admin/hymus-report.render.test.tsx), so the two can never
// print different money. The facts it prices live in hymus.job.ts.

import { applyMinimumCharges, deriveLines, mergeLines } from "./derive";
import { allocateLines, estimateTotals, rateCents } from "./trailer";
import { getLineItem } from "../catalog";
import { ESTIMATOR_STRINGS } from "./strings";
import { RESTAURATION_CT_TRAILER, type EstimateContext, type EstimateLine } from "./types";
import { alreadyOpen, estimateRooms } from "./hymus.job";
import { sqmToSqFt, roundQuantity } from "./units";

/**
 * Worked sample — SDC H1 Phase 3, 122 boul. Hymus, Pointe-Claire: units 302,
 * 202 and 102, one water loss running down through the stack.
 *
 * The owner, 14 Oct 2026, handing over Polygon's devis 1641745-SDC-H1:
 * *"create our estimation, follow with all our rules … with our pricing. I
 * don't care what they say, we're gonna keep our pricing because their pricing
 * is too low."* So: their measurements (hymus.job.ts), our rules, our
 * catalogue, our trailer.
 *
 * **The order of work is the app's own:** derive with the rules, then the
 * edits an operator makes in the estimate builder for what the rules cannot
 * see — each one a manual line with its reason in the NOTE, never a silent
 * change. The edits:
 *
 *  1. **Small openings priced as patches.** The rules bill drywall per square
 *     foot, which for a 4 pi² hole is about fifty dollars — a figure nobody
 *     closes a ceiling for, because a patch is three visits whatever its size.
 *     Our catalogue prices exactly this case (DW-PATCH-SM ≤ 1 pi², -MD 1–4,
 *     -LG 4–16, each), so every damage area under 16 pi² is billed as one
 *     patch of its size instead of the per-foot board and tape. The seal coat
 *     stays. The 45 pi² bathroom wall stays per square foot.
 *  2. **Detach & reset priced.** The rules derive détacher-réinstaller with
 *     no rate — the catalogue has no D&R items — and an unpriced line is a
 *     zero on a document going to a client. Each is priced at our own removal
 *     rate (ENLEV) plus our own install rate (REMPLAC): taking the fixture off
 *     and putting the same one back is those two jobs.
 *  3. **The sink's plumbing.** Our vanity install excludes the plumbing
 *     connection, so a licensed plumber is added for the disconnect and the
 *     reconnect: 2 h, two visits.
 *  4. **Insulation.** No rule sees insulation; their scope replaces it behind
 *     every wall patch, so it is added at our rate — install only where the
 *     cavity was opened during the emergency, out and back in the bathroom.
 *
 * Everything else is the rules as written, including the defaults that reach
 * past the damage (the whole ceiling repainted, the walls of a room with a
 * wall repair repainted, trim painted around the room, floor protection over
 * every affected room). Those are the owner's own scoping rules; the report to
 * him lists what they add so he can strike any of them line by line.
 *
 * Trailer: 10 % généraux + 5 % profit on the items — the "15 %" he chose for
 * the Tansley file (RESTAURATION_CT_TRAILER). No minimum charges: the table
 * is still his to fill (Conventions §6).
 *
 * Printed by hymus.sample.test.ts; rendered by hymus-report.render.test.tsx.
 */

const t = ESTIMATOR_STRINGS.fr;
export const HYMUS_TRAILER = RESTAURATION_CT_TRAILER;

/** Removal + install codes for a fixture taken off and put back. Mirrors the
    object table in rules.ts for the three fixtures this job resets. */
const RESET_ITEMS: Record<string, { removal: string; install: string }> = {
  toilet: { removal: "DEM-TOILET", install: "BATH-TOILET-INST" },
  vanity_cabinet: { removal: "DEM-VANITY", install: "BATH-VANITY-INST" },
  wall_cabinet: { removal: "DEM-CAB-LF", install: "CAB-INST-WALL" },
};

function patchCode(sqft: number): string {
  if (sqft <= 1) return "DW-PATCH-SM";
  if (sqft <= 4) return "DW-PATCH-MD";
  return "DW-PATCH-LG";
}

function manual(
  base: Omit<EstimateLine, "origin" | "provenance" | "issues" | "taxable" | "removed" | "removeRateCents" | "replaceRateCents" | "name"> & {
    name?: string;
  },
): EstimateLine {
  const install = base.itemCode ? getLineItem(base.itemCode) : undefined;
  const removal = base.removalItemCode ? getLineItem(base.removalItemCode) : undefined;
  return {
    ...base,
    name: base.name ?? install?.name ?? removal?.name ?? "",
    origin: "manual",
    provenance: "operator",
    removeRateCents: rateCents(base.removalItemCode),
    replaceRateCents: rateCents(base.itemCode),
    issues: [],
    taxable: install?.taxable ?? removal?.taxable ?? true,
    removed: false,
  };
}

export function buildHymusDevis() {
  const rooms = estimateRooms();
  const context: EstimateContext = {
    rooms,
    equipment: [],
    readings: [],
    asOf: new Date("2026-10-14T12:00:00Z"),
  };
  const derived = applyMinimumCharges(mergeLines([], deriveLines(context, "fr")), {}, "fr");

  const lines: EstimateLine[] = [];
  const roomById = new Map(rooms.map((r) => [r.roomScanId, r]));

  // Which room/surface pairs are patched (every area under 16 pi²).
  const patched = new Set<string>();
  for (const room of rooms) {
    for (const surface of ["wall", "ceiling"] as const) {
      const areas = room.affectedAreas.filter((a) => a.surface === surface);
      if (areas.length > 0 && areas.every((a) => sqmToSqFt(a.area_sqm) <= 16.0001)) {
        patched.add(`${room.roomScanId}:${surface}`);
      }
    }
  }

  for (const line of derived) {
    const surface = line.tradeSection === "walls" ? "wall" : line.tradeSection === "ceiling" ? "ceiling" : null;
    const isBoardOrTape =
      line.itemCode === "DW-INST-12" || line.itemCode === "DW-TAPE-L4";
    if (surface && isBoardOrTape && patched.has(`${line.roomScanId}:${surface}`)) continue;

    if (line.activity === "detachReset") {
      const objectId = line.key.split(":")[1];
      const object = roomById.get(line.roomScanId ?? "")?.objects.find((o) => o.id === objectId);
      const items = object ? RESET_ITEMS[object.kind] : undefined;
      if (object && items) {
        lines.push({
          ...manual({
            key: line.key,
            roomScanId: line.roomScanId,
            roomName: line.roomName,
            apartment: line.apartment,
            tradeSection: object.kind === "toilet" ? "plumbing" : "misc",
            activity: "detachReset",
            itemCode: items.install,
            removalItemCode: items.removal,
            name: line.name,
            unit: line.unit,
            quantity: line.quantity,
            calc: line.calc,
            note:
              "Détacher et réinstaller le même élément : notre taux d'enlèvement (ENLEV) + notre taux de pose (REMPLAC) — le catalogue n'a pas encore d'article D&R.",
          }),
        });
        continue;
      }
    }
    lines.push(line);
  }

  // 1 — patches, one per damage area.
  for (const room of rooms) {
    for (const area of room.affectedAreas) {
      if (area.surface === "floor") continue;
      if (!patched.has(`${room.roomScanId}:${area.surface}`)) continue;
      const sqft = roundQuantity(sqmToSqFt(area.area_sqm));
      const code = patchCode(sqft);
      lines.push(
        manual({
          key: `manual:${area.id}:patch`,
          roomScanId: room.roomScanId,
          roomName: room.name,
          apartment: room.apartment ?? null,
          tradeSection: area.surface === "wall" ? "walls" : "ceiling",
          activity: "install",
          itemCode: code,
          removalItemCode: null,
          unit: "each",
          quantity: 1,
          calc: `${area.name} — ${t.qty(sqft)} pi² mesurés : une réparation de cette taille`,
          note: alreadyOpen(area.id)
            ? "Ouverture faite pendant l'urgence : rien à enlever. Réparation complète (pose, ruban, trois couches, ponçage) au prix de notre article de réparation plutôt qu'au pied carré."
            : "Découpe incluse. Réparation complète au prix de notre article de réparation plutôt qu'au pied carré.",
        }),
      );
    }
  }

  // 2/4 — insulation behind every wall repair.
  for (const room of rooms) {
    for (const area of room.affectedAreas.filter((a) => a.surface === "wall")) {
      const sqft = roundQuantity(sqmToSqFt(area.area_sqm));
      const open = alreadyOpen(area.id);
      lines.push(
        manual({
          key: `manual:${area.id}:insulation`,
          roomScanId: room.roomScanId,
          roomName: room.name,
          apartment: room.apartment ?? null,
          tradeSection: "walls",
          activity: open ? "install" : "replace",
          itemCode: "INS-BATT-R12",
          removalItemCode: open ? null : "DEM-INSUL",
          unit: "sq ft",
          quantity: sqft,
          calc: `${area.name} — ${t.qty(sqft)} pi² de cavité`,
          note: open
            ? "Isolant en natte R12 dans la cavité ouverte pendant l'urgence."
            : "Isolant mouillé enlevé et remplacé (R12) avec le placoplâtre.",
        }),
      );
    }
  }

  // 3 — the plumber for the vanity's sink.
  const bath = rooms.find((r) => r.roomScanId === "hymus-102-bath")!;
  lines.push(
    manual({
      key: "manual:hymus-102-bath:plumber",
      roomScanId: bath.roomScanId,
      roomName: bath.name,
      apartment: bath.apartment ?? null,
      tradeSection: "plumbing",
      activity: "install",
      itemCode: "SUB-PLUM-HR",
      removalItemCode: null,
      name: "Plombier — débrancher et rebrancher l'évier de la vanité",
      unit: "hour",
      quantity: 2,
      calc: "2 visites × 1 h (débrancher avant les travaux, rebrancher après)",
      note: "Notre pose de vanité exclut le raccordement de plomberie.",
    }),
  );

  // Print order: apartment by apartment in the order their devis runs (302,
  // 202, 102 — the water's own path), each room's trades in the fixed order,
  // project lines last.
  const unitOrder = ["302", "202", "102"];
  const roomOrder = rooms.map((r) => r.roomScanId);
  const sections = ["floor", "ceiling", "walls", "trim", "plumbing", "electrical", "misc"];
  lines.sort((a, b) => {
    const ua = a.apartment ? unitOrder.indexOf(a.apartment) : 99;
    const ub = b.apartment ? unitOrder.indexOf(b.apartment) : 99;
    if (ua !== ub) return ua - ub;
    const ra = a.roomScanId ? roomOrder.indexOf(a.roomScanId) : 99;
    const rb = b.roomScanId ? roomOrder.indexOf(b.roomScanId) : 99;
    if (ra !== rb) return ra - rb;
    return sections.indexOf(a.tradeSection) - sections.indexOf(b.tradeSection);
  });

  const allocated = allocateLines(lines, HYMUS_TRAILER);
  const totals = estimateTotals(allocated);
  return { lines: allocated, totals, trailer: HYMUS_TRAILER };
}
