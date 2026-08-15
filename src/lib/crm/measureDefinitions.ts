/**
 * What a measurement actually means, stated beside the figure.
 *
 * "Floor area" has at least five legitimate definitions — to the inside
 * face, to the outside face, with or without interior partitions, with or
 * without openings deducted — and an adjuster who cannot tell which one a
 * number used is an adjuster who can discount it. Every figure this app
 * reports therefore carries its own definition: on the room sheet, in the
 * API response, and in the printed report.
 *
 * The definitions state what THIS app computes, and they are deliberately
 * plain about their limits: where a figure is measured from the scan's wall
 * faces rather than a finished surface, it says so, because a stated
 * approximation survives scrutiny and an unstated one does not.
 *
 * The native app ships the same definitions as `MeasureDefinition` in
 * ios/App/App/Native/Theme.swift. The two lists must not disagree — a
 * definition that changes between the phone and the report is worse than no
 * definition at all — so any change here is a change there too.
 *
 * Living area has its own definition, `LIVING_AREA_DEFINITION` in
 * livingArea.ts, shipped with the living-area response since before this
 * module existed. It stays there: the rules engine and its definition are
 * one unit.
 */

export type MeasureDefinition = {
  id: string;
  title: string;
  definition: string;
};

export const FLOOR_AREA_DEFINITION: MeasureDefinition = {
  id: "floor",
  title: "Floor area",
  definition:
    "The area enclosed by the room's walls, measured to the wall faces the scan " +
    "detected — the clear floor you could lay covering on. Interior partitions " +
    "inside the room, if any, are not deducted. Where the outline was corrected " +
    "by hand, the corrected outline is what is measured.",
};

export const PERIMETER_DEFINITION: MeasureDefinition = {
  id: "perimeter",
  title: "Perimeter",
  definition:
    "The total run of the walls — the interior perimeter, measured at floor " +
    "level, with doorways included in the run. It is the basis for wall area. " +
    "For trim, use baseboard length instead: that is this figure with the " +
    "doorways taken out.",
};

export const BASEBOARD_DEFINITION: MeasureDefinition = {
  id: "baseboard",
  title: "Baseboard length",
  definition:
    "The perimeter with every doorway taken out — the run trim actually " +
    "covers, since baseboard and shoe moulding do not cross a door or a cased " +
    "opening. Windows are not deducted; trim runs under them. This is the " +
    "figure to price linear-foot trim against, and on a room with two doors it " +
    "is close to a metre shorter than the perimeter.",
};

export const WALL_AREA_GROSS_DEFINITION: MeasureDefinition = {
  id: "walls-gross",
  title: "Wall area (gross)",
  definition:
    "Interior perimeter, at floor level, multiplied by ceiling height — every " +
    "square foot of wall that exists, counted full height with nothing deducted. " +
    "The figure framing and insulation are estimated from.",
};

export const WALL_AREA_NET_DEFINITION: MeasureDefinition = {
  id: "walls-net",
  title: "Wall area (net)",
  definition:
    "The gross wall area with the doors and windows the scan detected taken out — " +
    "the figure paint and drywall are priced from: nobody paints a doorway. A room " +
    "measured without a scan has no detected openings, so its net equals its gross.",
};

export const CEILING_HEIGHT_DEFINITION: MeasureDefinition = {
  id: "ceiling",
  title: "Ceiling height",
  definition:
    "The tallest wall the scan measured, floor to ceiling. A room with a sloped " +
    "or dropped ceiling has more than one height; this reports the greatest, so " +
    "anything derived from it is an upper bound.",
};

/**
 * Volume — floor area × ceiling height, the air in the room.
 *
 * The reference computes this too, as one more line in a statistics sheet.
 * Here it is not a statistic, it is the input to equipment sizing: IICRC S500
 * sizes dehumidification from the cubic footage of the affected space, and an
 * adjuster who questions why four LGRs were on site for six days is asking a
 * question that cubic feet answers and square feet cannot.
 *
 * Stated as an upper bound, for the same reason the ceiling height is: it
 * multiplies the tallest wall the scan found across the whole floor plate.
 */
export const VOLUME_DEFINITION: MeasureDefinition = {
  id: "volume",
  title: "Volume",
  definition:
    "Floor area multiplied by ceiling height — the air the room holds, which is " +
    "what dehumidification is sized from. Because ceiling height is the tallest " +
    "wall measured, a room with a sloped or dropped ceiling holds less air than " +
    "this figure states; it is an upper bound, and equipment sized from it errs " +
    "toward drying faster rather than slower.",
};

/**
 * The footprint including wall assemblies.
 *
 * These two were refused for months, and the refusal was right at the time:
 * they need a wall thickness, and a scan of wall faces does not have one.
 * What changed is that the operator states it now, per floor, the way the
 * reference does — and a stated thickness is not an invented one.
 *
 * They are honest about their own limit. Our rooms are scanned one at a time
 * and are not registered into a single footprint, so a room cannot know which
 * of its walls a neighbour is on the far side of. Each room is therefore grown
 * by HALF its wall thickness: a shared partition gets half from each side and
 * is counted once, correctly, while an exterior wall gets only its inner half.
 */
export const FOOTPRINT_INTERIOR_DEFINITION: MeasureDefinition = {
  id: "footprint-interior",
  title: "Footprint with interior walls",
  definition:
    "The floor area plus the partitions between rooms, using the wall thickness " +
    "set for this floor. Each room is grown by half that thickness, so a wall " +
    "shared by two rooms is counted once. On a floor with a single room there " +
    "are no partitions, and this equals the floor area.",
};

export const FOOTPRINT_GROSS_DEFINITION: MeasureDefinition = {
  id: "footprint-gross",
  title: "Footprint with all walls",
  definition:
    "The floor area plus every wall, using the thicknesses set for this floor — " +
    "the closest figure to a gross building footprint. It is an UNDER-estimate: " +
    "because rooms are scanned separately, an exterior wall cannot be told from " +
    "a shared one, so each room contributes only the inner half of its outer " +
    "walls. Expect it to read slightly under a figure measured to the outside " +
    "face of the building.",
};

/**
 * The definitions as one object, in the shape API responses attach — keyed
 * the way the figures themselves are named in those responses, so a client
 * can look a definition up from the field it is about to display.
 */
export const MEASURE_DEFINITIONS = {
  floorArea: FLOOR_AREA_DEFINITION,
  perimeter: PERIMETER_DEFINITION,
  baseboard: BASEBOARD_DEFINITION,
  wallAreaGross: WALL_AREA_GROSS_DEFINITION,
  wallAreaNet: WALL_AREA_NET_DEFINITION,
  ceilingHeight: CEILING_HEIGHT_DEFINITION,
  volume: VOLUME_DEFINITION,
  footprintInterior: FOOTPRINT_INTERIOR_DEFINITION,
  footprintGross: FOOTPRINT_GROSS_DEFINITION,
} as const;
