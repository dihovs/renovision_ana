// What other firms' real repair estimates teach about SCOPE — never price.
//
// Read from the Québec Xactimate estimates the owner has handed over
// (Docs/Estimator-Xactimate-Conventions.md lists them), most recently
// Polygon's 1641745-SDC-H1 (8 Oct 2026, three stacked condo units at 122 boul.
// Hymus) on 14 Oct 2026, and Lauresco's 3674_7027C_R (7027 rue Clark, unit 5)
// on 19 Oct 2026; on the first he asked: "if there is anything useful from
// their estimation that we can use in our AI system in the future, please
// pull it out."
//
// Two consumers:
//   - INSURANCE_SCOPE_PATTERNS goes into the estimate AI's system prompt
//     (estimate/actions.ts), so a proposal reaches for the work a seasoned
//     estimator would not forget. Patterns, not rules: the rules engine
//     (rules.ts) is what derives lines; these only inform what the model
//     proposes for the operator to accept or refuse.
//   - XACTIMATE_TO_CATALOGUE maps the reference documents' SÉL codes to our
//     catalogue, for reading another firm's devis (by hand today, by the
//     report importer next). A null means the catalogue has no item yet —
//     a gap to price by hand, never a reason to pick the nearest code.
//
// Their RATES are deliberately absent. The owner's ruling on this job: "we're
// gonna keep our pricing because their pricing is too low."

export const INSURANCE_SCOPE_PATTERNS: string[] = [
  "Openings the emergency crew already cut (notes like « ouverture faite pendant l'urgence », plastic over a hole) are closed in the repair estimate with no removal line — the material was already taken out.",
  "Close small openings (under about 16 sq ft each) with the drywall patch items (DW-PATCH-SM ≤ 1 sq ft, DW-PATCH-MD 1–4, DW-PATCH-LG 4–16), one per opening; per-square-foot board and tape on a 4 sq ft hole bills a fraction of the three visits it takes.",
  "Ceilings between units of a condo or multi-unit building are fire separations: replace ceiling board with 5/8\" Type X (DW-INST-58), not 1/2\".",
  "Wherever a wall cavity was opened, the batt insulation behind it is replaced at the opened area (INS-BATT-R12 in 2×4 walls); remove it too (DEM-INSUL) only if the cavity is opened in the repair itself.",
  "A bathroom wall that soaked up water behind its fixtures takes, together: detach & reset of the wall cabinets and the vanity with its top, detach & reset of the toilet, a plumber to disconnect and reconnect the sink, the drywall and insulation out and back on that wall, antimicrobial on the opened surface (the reference estimator asked for a mould check behind the cabinets), and repaint.",
  "Baseboard off a repaired wall: remove-and-replace at the affected run, paint the same length, and expect a little carpentry time for the small fitting.",
  "Plastic protection over the full floor of every room worked in; cleaning per room, plus the building's common areas on a multi-unit job.",
  "Stacked units (302 above 202 above 102) are one loss with one floor plan repeated: price each unit as its own section and subtotal, expect the damage to change floor by floor, and check every unit below the source.",
  "General conditions on a multi-unit job: debris haul, delivery of materials, supervision hours; another firm may add a management fee and per-trade minimum charges per unit — note them when comparing, do not copy them.",
  "Surfaces another estimate marks « NON AFFECTÉ » get no lines; do not repaint or replace them on that estimate's say-so alone.",
  "A ceiling opened under the bath of the unit above (a drain leak) is usually a rated floor-ceiling assembly: two layers of board to close it, fire-rated caulk on the first layer, wood furring as screw backing at the opening's edges, the cavity's framing cleaned and treated, and the wet insulation (often loose cellulose) replaced with batts of the full depth — the reference job specified 12\" R40.",
  "A wall strip opened under a baseboard that was kept on site: patch the strip, reinstall the same baseboard (install only, nothing bought), caulk it and paint it; measure the baseboard with the return round any wall end.",
  "Another firm may print its whole scope inside per-trade minimum charges, every line marked « INCLUS » with a quantity and no price: read those lines for the scope and quantities, price each one with our items.",
  "A sketch's « Mur manquant … Ouvre sur Extérieur » is an open side of the room — no wall, no paint, no baseboard on it.",
];

/** Xactimate SÉL codes (Québec French price lists, QCMO8X) → our catalogue.
    `items` is the closest catalogue pairing for the same WORK; null where the
    catalogue has nothing yet. */
export const XACTIMATE_TO_CATALOGUE: Record<
  string,
  { describes: string; items: { install?: string; removal?: string } | null }
> = {
  "PCP 5/8": { describes: "5/8\" drywall — hung, taped, finished, ready for paint", items: { install: "DW-INST-58", removal: "DEM-DRYWALL" } },
  "PCP PL<5/8": { describes: "5/8\" drywall per linear foot, up to 4\" high (strip at the floor)", items: { install: "DW-PATCH-SM" } },
  "PCP CSMMM": { describes: "Drywall minimum charge, labour and material", items: { install: "DW-PATCH-MD" } },
  "PNT S": { describes: "Stain-blocking sealer, one coat (billed at 125 % of the patch)", items: { install: "PNT-STAINBLOCK" } },
  "PNT P2": { describes: "Paint the surface, two coats (ceiling at PLF, walls at the area)", items: { install: "PNT-CEIL-2" } },
  "PNT PL1G": { describes: "Latex paint by the gallon, material only", items: null },
  "PNT PLC2": { describes: "Paint baseboard / quarter round, two coats", items: { install: "PNT-TRIM-LF" } },
  "ISO FV4": { describes: "Batt insulation 4\" R12, unfaced", items: { install: "INS-BATT-R12", removal: "DEM-INSUL" } },
  "ISO FV4PL": { describes: "Batt insulation per linear foot, up to 4\" high", items: { install: "INS-BATT-R12" } },
  "ISO MIN": { describes: "Insulation minimum charge", items: null },
  "FIN P5MPP": { describes: "Remove and replace 5¼\" MDF baseboard, flat profile", items: { install: "TRIM-BASE-INST", removal: "DEM-BASE" } },
  "FIN QR": { describes: "Remove and replace 3/4\" quarter round", items: null },
  "FIN MN-A": { describes: "Finish carpentry minimum labour charge", items: null },
  "CHP M-O": { describes: "General carpenter, per hour", items: null },
  "CHP MN-A": { describes: "Framing minimum labour charge", items: null },
  "DMO PLCLPC": { describes: "Mask or cover per square foot, 6 mil poly", items: { install: "GEN-FLOOR-PROT" } },
  "DMO CAMION-": { describes: "Debris haul per pickup load, dump fees included", items: { removal: "GEN-DUMP-SM" } },
  "NET M-O": { describes: "Cleaning technician, per hour", items: { install: "GEN-CLEAN-DAY" } },
  "PLB TLTRR": { describes: "Toilet — detach and reset", items: { install: "BATH-TOILET-INST", removal: "DEM-TOILET" } },
  "PLB ÉVRRR": { describes: "Sink, single — detach and reset", items: { install: "SUB-PLUM-HR" } },
  "ÉBN HAUT": { describes: "Upper (wall) cabinets — detach and reset, per linear foot", items: { install: "CAB-INST-WALL", removal: "DEM-CAB-LF" } },
  "ÉBN MBLVCS": { describes: "Vanity with cultured-marble or solid-surface top — detach and reset", items: { install: "BATH-VANITY-INST", removal: "DEM-VANITY" } },
  "MOS SUPERR": { describes: "Residential supervision / project management, per hour", items: { install: "GEN-PM-HR" } },
  "PHN LIVR": { describes: "Delivery fee (bid item)", items: null },
  "PHN GES": { describes: "Management fee, 3 % of the items", items: null },
};
