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

/**
 * **The same definitions, in the language the report is printed in.**
 *
 * These are not a nicety on this page: the definitions appendix is the whole
 * argument when the carrier's own figure differs from ours, and an argument
 * a francophone adjuster has to translate before they can weigh it is an
 * argument that gets skipped. Under Bill 96 it is also the version that has
 * to exist.
 *
 * A parallel table rather than a `definitionFr` field on each object, because
 * the English ones above are shipped verbatim in API responses and mirrored
 * in `ios/App/App/Native/Theme.swift`; widening that shape would push a
 * report-only concern into both. `measureDefinitions(locale)` is the one door
 * a caller uses.
 *
 * Translated by trade meaning, not by dictionary: `superficie` for an area a
 * surface has, `aire` never (that is a mathematical area); `plinthe` for
 * baseboard, which is what a Québec finisher calls it; `emprise au sol` for
 * footprint, the term used on a plan; `sous-estimation` stated as plainly as
 * the English states UNDER-estimate, because the caveat is the point.
 */
const MEASURE_DEFINITIONS_FR: Record<
  keyof typeof MEASURE_DEFINITIONS,
  MeasureDefinition
> = {
  floorArea: {
    id: "floor",
    title: "Superficie de plancher",
    definition:
      "La superficie délimitée par les murs de la pièce, mesurée jusqu'aux faces " +
      "de mur relevées par le balayage — le plancher dégagé sur lequel un " +
      "revêtement pourrait être posé. Les cloisons intérieures à la pièce, s'il y " +
      "en a, ne sont pas déduites. Lorsque le contour a été corrigé à la main, " +
      "c'est le contour corrigé qui est mesuré.",
  },
  perimeter: {
    id: "perimeter",
    title: "Périmètre",
    definition:
      "Le développement total des murs — le périmètre intérieur, mesuré au niveau " +
      "du plancher, les baies de porte comprises dans le parcours. C'est la base " +
      "de la superficie des murs. Pour les boiseries, utiliser plutôt la longueur " +
      "de plinthe : c'est cette même mesure, baies de porte déduites.",
  },
  baseboard: {
    id: "baseboard",
    title: "Longueur de plinthe",
    definition:
      "Le périmètre dont chaque baie de porte a été retirée — le parcours que la " +
      "boiserie couvre réellement, puisque la plinthe et le quart-de-rond ne " +
      "traversent ni une porte ni une ouverture encadrée. Les fenêtres ne sont pas " +
      "déduites; la boiserie passe dessous. C'est la mesure à laquelle chiffrer " +
      "les boiseries au pied linéaire, et dans une pièce à deux portes elle est " +
      "inférieure au périmètre de près d'un mètre.",
  },
  wallAreaGross: {
    id: "walls-gross",
    title: "Superficie des murs (brute)",
    definition:
      "Le périmètre intérieur, au niveau du plancher, multiplié par la hauteur " +
      "sous plafond — chaque pied carré de mur existant, compté sur toute la " +
      "hauteur, sans aucune déduction. C'est la mesure à partir de laquelle la " +
      "charpente et l'isolation sont estimées.",
  },
  wallAreaNet: {
    id: "walls-net",
    title: "Superficie des murs (nette)",
    definition:
      "La superficie brute des murs dont les portes et les fenêtres relevées par " +
      "le balayage ont été retirées — la mesure à laquelle la peinture et le " +
      "placoplâtre sont chiffrés : personne ne peint une baie de porte. Une pièce " +
      "mesurée sans balayage n'a aucune ouverture détectée; sa superficie nette " +
      "égale alors sa superficie brute.",
  },
  ceilingHeight: {
    id: "ceiling",
    title: "Hauteur sous plafond",
    definition:
      "Le mur le plus haut relevé par le balayage, du plancher au plafond. Une " +
      "pièce dont le plafond est incliné ou surbaissé a plus d'une hauteur; c'est " +
      "la plus grande qui est rapportée ici, de sorte que tout ce qui en découle " +
      "constitue une borne supérieure.",
  },
  volume: {
    id: "volume",
    title: "Volume",
    definition:
      "La superficie de plancher multipliée par la hauteur sous plafond — l'air " +
      "que contient la pièce, soit ce à partir de quoi la déshumidification est " +
      "dimensionnée. Comme la hauteur sous plafond est celle du mur le plus haut " +
      "relevé, une pièce au plafond incliné ou surbaissé contient moins d'air que " +
      "ce chiffre ne l'indique : c'est une borne supérieure, et l'équipement " +
      "dimensionné à partir d'elle pèche par excès de séchage plutôt que " +
      "l'inverse.",
  },
  footprintInterior: {
    id: "footprint-interior",
    title: "Emprise au sol avec les cloisons intérieures",
    definition:
      "La superficie de plancher augmentée des cloisons entre les pièces, selon " +
      "l'épaisseur de mur retenue pour cet étage. Chaque pièce est agrandie de la " +
      "moitié de cette épaisseur, de sorte qu'un mur partagé par deux pièces n'est " +
      "compté qu'une fois. À un étage ne comptant qu'une seule pièce, il n'y a " +
      "aucune cloison et cette mesure égale la superficie de plancher.",
  },
  footprintGross: {
    id: "footprint-gross",
    title: "Emprise au sol avec tous les murs",
    definition:
      "La superficie de plancher augmentée de tous les murs, selon les épaisseurs " +
      "retenues pour cet étage — la mesure la plus proche d'une emprise au sol " +
      "brute du bâtiment. Il s'agit d'une SOUS-ESTIMATION : comme les pièces sont " +
      "balayées séparément, un mur extérieur ne peut être distingué d'un mur " +
      "mitoyen, et chaque pièce n'apporte donc que la moitié intérieure de ses " +
      "murs extérieurs. Attendez-vous à ce qu'elle se situe légèrement sous une " +
      "mesure prise à la face extérieure du bâtiment.",
  },
};

/** The definitions in the document's own language — the one door a report or
    an API response uses. English stays the default: it is the shape the API
    has always returned and the one the Swift twin mirrors. */
export function measureDefinitions(
  locale: "en" | "fr",
): Record<keyof typeof MEASURE_DEFINITIONS, MeasureDefinition> {
  return locale === "fr" ? MEASURE_DEFINITIONS_FR : MEASURE_DEFINITIONS;
}
