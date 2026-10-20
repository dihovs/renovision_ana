// Our devis for SDC du 7027 Clark, unit 5 — the arithmetic, shared by the
// printed sample (clark.sample.test.ts) and the report render
// (src/components/admin/clark-report.render.test.tsx). The facts live in
// clark.job.ts.

import { applyMinimumCharges, deriveLines, mergeLines } from "./derive";
import { allocateLines, estimateTotals, rateCents } from "./trailer";
import { getLineItem } from "../catalog";
import { ESTIMATOR_STRINGS } from "./strings";
import { RESTAURATION_CT_TRAILER, type EstimateContext, type EstimateLine } from "./types";
import { alreadyOpen, estimateRooms, roomId } from "./clark.job";
import { sqmToSqFt, roundQuantity } from "./units";

/**
 * Lauresco's devis 3674_7027C_R (2 210,64 $), priced our way — the owner's
 * standing ruling from the Hymus job: our catalogue, our rules, never their
 * rates (memory: keep our pricing).
 *
 * Rules first, then only the edits an operator makes in the estimate builder
 * for what the rules cannot see, each a manual line with its reason:
 *
 *  1. **The ceiling opening as a patch** (DW-PATCH-LG, 5 pi²), nothing to
 *     remove — it was opened in the emergency. Their ceiling is two layers of
 *     1/2" with fire-rated caulk: the second layer is priced as board
 *     (DW-INST-12, 5 pi²) and the caulk as TRIM-CAULK (8 pi lin.), both noted.
 *  2. **The cavity**: 16 pi² of framing cleaned and treated (RST-ANTIMIC) and
 *     re-insulated. Theirs is 12" R40 fibreglass; our catalogue's heaviest batt
 *     is R20, so two layers of it (32 pi²) — noted.
 *     The 1"×3" furring they screw the new board to is wood backing
 *     (FRM-BLOCK) along the opening's two sides between the joists.
 *  3. **The wall strip** under the hall's baseboard as a small patch
 *     (DW-PATCH-SM, 2 pi × 4 po); the baseboard was kept on site, so it is
 *     reinstalled, not replaced (install only, no removal), on THEIR measure,
 *     2,33 pi lin. — the 2' wall and the 4" return round its end — and
 *     caulked (TRIM-CAULK), as theirs is.
 *  4. **A dust barrier** at the bathroom door (GEN-DUST-DOOR) and **travel**
 *     (GEN-TRAVEL, two round trips Laval–Montréal for a one-to-two-day job),
 *     which their scope carries and no rule derives.
 *
 * Not priced, because the catalogue has nothing for them (reported as gaps):
 * the painter's hour to take down and put back the fixtures, and their four
 * hours carrying debris and tools through the building's common areas.
 *
 * Trailer: his "15 %" (RESTAURATION_CT_TRAILER). No minimums (his to set).
 */

const t = ESTIMATOR_STRINGS.fr;
export const CLARK_TRAILER = RESTAURATION_CT_TRAILER;

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

export function buildClarkDevis() {
  const rooms = estimateRooms();
  const context: EstimateContext = { rooms, equipment: [], readings: [], asOf: new Date("2026-10-19T12:00:00Z") };
  const derived = applyMinimumCharges(mergeLines([], deriveLines(context, "fr")), {}, "fr");

  const bath = rooms.find((r) => r.roomScanId === roomId("bath"))!;
  const hall = rooms.find((r) => r.roomScanId === roomId("hall"))!;
  const lines: EstimateLine[] = [];

  for (const line of derived) {
    // Board and tape by the square foot on the openings → patches (edit 1, 3).
    if (line.itemCode === "DW-INST-12" || line.itemCode === "DW-TAPE-L4") continue;
    // The hall's baseboard was kept: reinstall, no removal, no new stock bought
    // beyond what our install rate carries (edit 3).
    if (line.itemCode === "TRIM-BASE-INST" && line.removalItemCode) {
      lines.push({
        ...line,
        origin: "manual",
        provenance: "operator",
        name: "Réinstaller la plinthe existante",
        activity: "install",
        removalItemCode: null,
        removeRateCents: null,
        quantity: 2.33,
        calc: "2,33 pi lin. — le mur de 2 pi et le retour de 4 po à son bout (leur mesure)",
        note: "Plinthe existante, enlevée pendant l'urgence et conservée sur place : réinstallée, rien à enlever ni à acheter.",
      });
      continue;
    }
    lines.push(line);
  }

  for (const room of [bath, hall]) {
    for (const area of room.affectedAreas) {
      const sqft = roundQuantity(sqmToSqFt(area.area_sqm));
      lines.push(
        manual({
          key: `manual:${area.id}:patch`,
          roomScanId: room.roomScanId,
          roomName: room.name,
          apartment: null,
          tradeSection: area.surface === "wall" ? "walls" : "ceiling",
          activity: "install",
          itemCode: patchCode(sqft),
          removalItemCode: null,
          unit: "each",
          quantity: 1,
          calc: `${area.name} — ${t.qty(sqft)} pi² mesurés : une réparation de cette taille`,
          note: alreadyOpen(area.id)
            ? "Ouverture faite pendant l'urgence : rien à enlever. Réparation complète (pose, ruban, trois couches, ponçage) au prix de notre article de réparation."
            : "Découpe incluse. Réparation complète au prix de notre article de réparation.",
        }),
      );
    }
  }

  type Rest = Omit<Parameters<typeof manual>[0], "key" | "roomScanId" | "roomName" | "apartment">;
  const roomLine = (room: typeof bath, key: string, rest: Rest) =>
    manual({ key: `manual:${room.roomScanId}:${key}`, roomScanId: room.roomScanId, roomName: room.name, apartment: null, ...rest });
  const bathLine = (key: string, rest: Rest) => roomLine(bath, key, rest);

  lines.push(
    bathLine("furring", {
      tradeSection: "ceiling",
      activity: "install",
      itemCode: "FRM-BLOCK",
      removalItemCode: null,
      name: "Fond de vissage en fourrure 1 po × 3 po",
      unit: "linear ft",
      quantity: 4.5,
      calc: "2 côtés × 2,24 pi (ouverture de 5 pi²) — entre les solives, là où le placoplâtre n'a rien pour se visser",
      note: "Leur devis : fourrure 1 po × 3 po sur 5 p2. Posée au taux de notre article de blocage.",
    }),
    bathLine("second-layer", {
      tradeSection: "ceiling",
      activity: "install",
      itemCode: "DW-INST-12",
      removalItemCode: null,
      name: "Deuxième épaisseur de placoplâtre 1/2 po (séparation coupe-feu)",
      unit: "sq ft",
      quantity: 5,
      calc: "5 pi² × 1 épaisseur de plus — le plafond est en double épaisseur (leur devis : 5 p2 × 2 = 10 p2)",
      note: "La réparation couvre la première épaisseur; la deuxième est posée au taux de pose de notre catalogue.",
    }),
    bathLine("fire-caulk", {
      tradeSection: "ceiling",
      activity: "install",
      itemCode: "TRIM-CAULK",
      removalItemCode: null,
      name: "Calfeutrage ignifuge au pourtour de l'ouverture",
      unit: "linear ft",
      quantity: 8,
      calc: "8 pi lin. — pourtour de l'ouverture, sur la première épaisseur",
      note: "Notre catalogue n'a pas de scellant ignifuge distinct : calfeutrage au taux de notre article, produit ignifuge à fournir.",
    }),
    bathLine("cavity-antimicrobial", {
      tradeSection: "ceiling",
      activity: "install",
      itemCode: "RST-ANTIMIC",
      removalItemCode: null,
      name: "Nettoyage et antimicrobien de la charpente du plafond",
      unit: "sq ft",
      quantity: 16,
      calc: "16 pi² de charpente exposée dans la cavité (leur mesure)",
      note: "La charpente de la cavité, en plus des surfaces de placoplâtre touchées.",
    }),
    bathLine("insulation", {
      tradeSection: "ceiling",
      activity: "install",
      itemCode: "INS-BATT-R20",
      removalItemCode: null,
      name: "Isolant en natte de fibre de verre — deux rangs R20 (≈ R40, 12 po)",
      unit: "sq ft",
      quantity: 32,
      calc: "16 pi² × 2 rangs — leur devis : natte 12 po R40 sur 16 p2",
      note: "Remplace la cellulose mouillée enlevée pendant l'urgence. Notre catalogue s'arrête à R20 : deux rangs pour l'équivalent R40.",
    }),
    bathLine("dust-barrier", {
      tradeSection: "misc",
      activity: "install",
      itemCode: "GEN-DUST-DOOR",
      removalItemCode: null,
      name: undefined,
      unit: "each",
      quantity: 1,
      calc: "1 barrière à la porte de la salle de bains — leur devis : barrière anti-poussière 64 p2",
      note: null,
    }),
    roomLine(hall, "base-caulk", {
      tradeSection: "trim",
      activity: "install",
      itemCode: "TRIM-CAULK",
      removalItemCode: null,
      name: undefined,
      unit: "linear ft",
      quantity: 2.33,
      calc: "2,33 pi lin. — la plinthe réinstallée",
      note: null,
    }),
    manual({
      key: "manual:job:travel",
      roomScanId: null,
      roomName: t.generalConditions,
      apartment: null,
      tradeSection: "misc",
      activity: "install",
      itemCode: "GEN-TRAVEL",
      removalItemCode: null,
      name: undefined,
      unit: "hour",
      quantity: 2,
      calc: "2 allers-retours Laval–Montréal × 1 h — travaux de 1 à 2 jours (leur devis : 2 × frais de déplacement)",
      note: null,
    }),
  );

  const roomOrder = [bath.roomScanId, hall.roomScanId];
  const sections = ["floor", "ceiling", "walls", "trim", "plumbing", "electrical", "misc"];
  lines.sort((a, b) => {
    const ra = a.roomScanId ? roomOrder.indexOf(a.roomScanId) : 99;
    const rb = b.roomScanId ? roomOrder.indexOf(b.roomScanId) : 99;
    if (ra !== rb) return ra - rb;
    return sections.indexOf(a.tradeSection) - sections.indexOf(b.tradeSection);
  });

  const allocated = allocateLines(lines, CLARK_TRAILER);
  return { lines: allocated, totals: estimateTotals(allocated), trailer: CLARK_TRAILER };
}
