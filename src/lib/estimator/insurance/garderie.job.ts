// A daycare's common areas, repainted grey — the street entrance and its
// stair (ground floor, room 310), Vestibule 200 upstairs, and the kitchen
// A208 as an option. Handed over by the owner on 14 Nov 2026: three phone
// photos of her printed plans and six site photos. Priced in
// garderie.devis.ts, printed by src/components/admin/garderie-report.render.test.tsx.
//
// ---------------------------------------------------------------------------
// The rooms — traced off the photographed sheets, then calibrated so each
// traced floor equals the area printed in its room tag.
//
// Upstairs sheet (her photo 2, the A2xx/B2xx floor): the photo is keystoned,
// so the horizontal scale grows down the page — 35,3 px/ft on the kitchen's
// 8'-3 1/2" (y ≈ 690) to 39,0 px/ft on the facade bays 8'-2 5/8", 7'-11 1/2",
// 6'-5 1/2" (y ≈ 1562) — and the vertical runs 2,3 % shorter (the 22'-2"
// chain reads 22,17 ft with that factor; the 6'-1 3/8" check then reads
// 6'-2 3/8"). Traced on that model, Vestibule 200 came to 297,7 pi² against
// the printed 28,95 m² (311,6 pi²); lengths ×1,023 and the walls squared.
// Kitchen A208 (her photo 1): 283 × 723 px, 35,3 px/ft on its own printed
// 15,24 m² — 8'-0" × 20'-6" inside (the printed 8'-3 1/2" runs over the
// walls). Room 310 (her photo 3, the ground floor, no figures but its tag):
// 354 × 600 px on 16,76 m² — 10'-4" × 17'-6".
//
//   Vestibule 200   311,6 pi² drawn · 311,6 printed
//   Cuisine A208    164,0 pi² drawn · 164,0 printed
//   Hall 310        180,4 pi² drawn · 180,4 printed
//
// Heights are not on the plans. Read off the site photos against the 7'
// doors: ~10'-0" to the suspended ceiling upstairs; the entrance taken at
// 10'-0" as well. To be checked on site — the price follows the measure.

import type { RoomObject } from "../../crm/roomObjects";
import type { EstimateRoom } from "./types";

const FT = 0.3048;
const m = (feet: number) => feet * FT;
const sqm = (sqft: number) => sqft * FT * FT;

export type Pt = { x: number; y: number };
type Opening = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  kind: "door" | "opening" | "window";
  hinge?: "start" | "end";
  opens?: "in" | "out";
  /** For the wall-area deduction. */
  heightFt: number;
  label: string;
};
type PlacedObject = { kind: string; name: string; widthFt: number; depthFt: number; atFt: Pt; rotation: number };

export type GarderieRoomShape = {
  key: "entrance" | "vestibule" | "kitchen";
  name: string;
  level: string;
  roomType: string;
  polygonFt: Pt[];
  openingsFt: Opening[];
  /** Edges that are storefront glass, not painted wall. */
  glassEdges: number[];
  atFt: Pt;
  ceilingFt: number;
  objects: PlacedObject[];
  /** Painted surfaces the room's own walls do not carry (half-walls). */
  extraWalls: { label: string; lengthFt: number; heightFt: number; faces: number }[];
  /** Wall area hidden behind fixed counters and appliances. */
  hiddenSqFt: number;
  option?: boolean;
};

export const LEVEL_GROUND = "Rez-de-chaussée";
export const LEVEL_UP = "Étage";
/** Her sheets draw the partitions about 4 1/2". */
export const WALL_THICKNESS_M = (4.5 / 12) * FT;

const DOOR = 7;
const WINDOW = 4;

export const ROOM_SHAPES: GarderieRoomShape[] = [
  {
    key: "entrance",
    name: "Hall d'entrée et escalier (310)",
    level: LEVEL_GROUND,
    roomType: "entry",
    // 10'-4" × 17'-6". Edge 2 (the facade, run right to left) is the
    // storefront: the double door PVE2 between two short piers.
    polygonFt: [
      { x: 0, y: 0 },
      { x: 10.33, y: 0 },
      { x: 10.33, y: 17.5 },
      { x: 0, y: 17.5 },
    ],
    openingsFt: [
      // East: the glass door "Ascenseur →" into 312, hung on its north jamb,
      // swinging into the hall.
      { x1: 10.33, y1: 13.49, x2: 10.33, y2: 16.23, kind: "door", hinge: "start", opens: "in", heightFt: DOOR, label: "Porte vitrée de l'ascenseur" },
      // Facade: PVE2, a pair swinging out to the street.
      { x1: 9.82, y1: 17.5, x2: 5.74, y2: 17.5, kind: "door", hinge: "start", opens: "out", heightFt: DOOR, label: "Porte d'entrée (vantail est)" },
      { x1: 5.74, y1: 17.5, x2: 1.66, y2: 17.5, kind: "door", hinge: "end", opens: "out", heightFt: DOOR, label: "Porte d'entrée (vantail ouest)" },
      // West: PVI7 into the store's vestibule 311, hung on its south jamb,
      // swinging out of the hall.
      { x1: 0, y1: 16.12, x2: 0, y2: 13.49, kind: "door", hinge: "start", opens: "out", heightFt: DOOR, label: "Porte du magasin (PVI7)" },
    ],
    glassEdges: [2],
    atFt: { x: 0, y: 0 },
    ceilingFt: 10,
    objects: [
      // The flight up (UP) and, beside it, the closed flight down to the
      // basement behind the white door; the wall between them.
      { kind: "stairs", name: "Escalier vers l'étage", widthFt: 3.12, depthFt: 9.74, atFt: { x: 3.22, y: 5.83 }, rotation: 0 },
      { kind: "bulkhead", name: "Mur entre les volées", widthFt: 0.76, depthFt: 10.49, atFt: { x: 5.16, y: 6.21 }, rotation: 0 },
      { kind: "stairs", name: "Escalier du sous-sol (porte blanche)", widthFt: 2.74, depthFt: 7.75, atFt: { x: 6.91, y: 7.58 }, rotation: 0 },
    ],
    extraWalls: [],
    hiddenSqFt: 0,
  },
  {
    key: "vestibule",
    name: "Vestibule 200",
    level: LEVEL_UP,
    roomType: "hallway",
    // Clockwise from the corridor's north-west corner. The square block cut
    // out at the north-west is the elevator; the one at the south-west is a
    // bay of the office A201; the angled wall at the south-east is B209's.
    polygonFt: [
      { x: 0, y: 0 }, //        0 → corridor north wall
      { x: 14.3, y: 0 }, //     1 → east wall (door to Local 1 at its top)
      { x: 14.3, y: 22.93 }, // 2 → angled wall
      { x: 12.3, y: 24.67 }, // 3 → short return
      { x: 12.3, y: 27.36 }, // 4 → facade (window)
      { x: 4.67, y: 27.36 }, // 5 → A201's wall, beside the stair
      { x: 4.67, y: 20.09 }, // 6 → alcove's south wall
      { x: 0, y: 20.09 }, //    7 → alcove's west wall
      { x: 0, y: 10.19 }, //    8 → alcove's north wall / elevator's south side
      { x: 10.7, y: 10.19 }, // 9 → end of that wall
      { x: 10.7, y: 9.76 }, //  10 → its north face
      { x: 6.1, y: 9.76 }, //   11 → elevator's east wall (elevator door)
      { x: 6.1, y: 4.21 }, //   12 → corridor's south wall
      { x: 0, y: 4.21 }, //     13 → west wall (PVI7)
    ],
    openingsFt: [
      { x1: 14.3, y1: 0.15, x2: 14.3, y2: 2.9, kind: "door", hinge: "end", opens: "in", heightFt: DOOR, label: "Porte vers le Local 1" },
      { x1: 10.6, y1: 27.36, x2: 6.6, y2: 27.36, kind: "window", heightFt: WINDOW, label: "Fenêtre de la façade" },
      { x1: 6.1, y1: 7.91, x2: 6.1, y2: 5.26, kind: "door", hinge: "end", opens: "out", heightFt: DOOR, label: "Porte de l'ascenseur" },
      { x1: 0, y1: 3.65, x2: 0, y2: 0.9, kind: "door", hinge: "end", opens: "in", heightFt: DOOR, label: "Porte PVI7" },
    ],
    glassEdges: [],
    atFt: { x: 0, y: 0 },
    ceilingFt: 10,
    objects: [
      { kind: "stairs", name: "Escalier vers le rez-de-chaussée", widthFt: 3.07, depthFt: 7.79, atFt: { x: 6.135, y: 17.645 }, rotation: 0 },
    ],
    // The guard round the stair opening: a half-wall on its west side and
    // north end (the east side is the metal railing). The vestibule faces
    // and the caps here; the faces over the stair are in the stairwell line.
    extraWalls: [
      { label: "Muret ouest de l'escalier", lengthFt: 6.34, heightFt: 3.5, faces: 1 },
      { label: "Muret nord de l'escalier", lengthFt: 3.07, heightFt: 3.5, faces: 1 },
      { label: "Dessus des murets (6 po)", lengthFt: 9.41, heightFt: 0.5, faces: 1 },
    ],
    hiddenSqFt: 0,
  },
  {
    key: "kitchen",
    name: "Cuisine A208 (option)",
    level: LEVEL_UP,
    roomType: "kitchen",
    // 8'-0" × 20'-6". Edge 2 (south, run right to left) is the new wall
    // drawn on her plan, with its door 3'-11 1/4" in, hung on the east jamb,
    // swinging into the kitchen.
    polygonFt: [
      { x: 0, y: 0 },
      { x: 8, y: 0 },
      { x: 8, y: 20.5 },
      { x: 0, y: 20.5 },
    ],
    openingsFt: [{ x1: 5.07, y1: 20.5, x2: 2.9, y2: 20.5, kind: "door", hinge: "start", opens: "in", heightFt: DOOR, label: "Porte de la cuisine" }],
    glassEdges: [],
    // West of the vestibule's corridor: east face 1'-1" past PVI7's wall,
    // south face level with the corridor's north wall.
    atFt: { x: -9.05, y: -20.56 },
    ceilingFt: 10,
    objects: [
      { kind: "range", name: "Cuisinière", widthFt: 2.1, depthFt: 2.4, atFt: { x: 4.2, y: 1.2 }, rotation: 0 },
      { kind: "refrigerator", name: "Réfrigérateur", widthFt: 2.1, depthFt: 2.1, atFt: { x: 6.55, y: 1.05 }, rotation: 0 },
      { kind: "base_cabinet", name: "Comptoir et évier double", widthFt: 2, depthFt: 7.4, atFt: { x: 1.0, y: 7.2 }, rotation: 0 },
      { kind: "base_cabinet", name: "Comptoir et lavabos", widthFt: 1.6, depthFt: 5.5, atFt: { x: 7.2, y: 8.55 }, rotation: 0 },
    ],
    extraWalls: [],
    // Behind the refrigerator (2,1 × 6), the range (2,1 × 3), and the two
    // counters with their backsplash (7,4 × 4,5 and 5,5 × 3).
    hiddenSqFt: 12.6 + 6.3 + 33.3 + 16.5,
    option: true,
  },
];

export function edgeLengthsFt(polygon: Pt[]): number[] {
  return polygon.map((p, i) => {
    const q = polygon[(i + 1) % polygon.length];
    return Math.hypot(q.x - p.x, q.y - p.y);
  });
}

export function shoelaceSqFt(polygon: Pt[]): number {
  let twice = 0;
  polygon.forEach((p, i) => {
    const q = polygon[(i + 1) % polygon.length];
    twice += p.x * q.y - q.x * p.y;
  });
  return Math.abs(twice) / 2;
}

export function roomId(key: GarderieRoomShape["key"]): string {
  return `garderie-${key}`;
}

const widthOf = (o: Opening) => Math.hypot(o.x2 - o.x1, o.y2 - o.y1);

/**
 * What the painter paints in a room, from the drawing. Storefront edges carry
 * no painted wall but their piers; openings come off at their own height;
 * half-walls are added; what stands in front of a wall is taken off.
 */
export function roomFigures(shape: GarderieRoomShape) {
  const lengths = edgeLengthsFt(shape.polygonFt);
  const perimeterFt = lengths.reduce((s, l) => s + l, 0);
  // On a storefront edge only the piers beside the doors are wall.
  const pierFt = shape.glassEdges.reduce((s, i) => {
    const doorRun = shape.openingsFt
      .filter((o) => o.y1 === shape.polygonFt[i].y && o.y2 === shape.polygonFt[i].y)
      .reduce((w, o) => w + widthOf(o), 0);
    return s + lengths[i] - doorRun;
  }, 0);
  const glassFt = shape.glassEdges.reduce((s, i) => s + lengths[i], 0);
  const walledFt = perimeterFt - glassFt + pierFt;
  const wallOpenings = shape.openingsFt.filter(
    (o) => !shape.glassEdges.some((i) => o.y1 === shape.polygonFt[i].y && o.y2 === shape.polygonFt[i].y),
  );
  const openingSqFt = wallOpenings.reduce((s, o) => s + widthOf(o) * o.heightFt, 0);
  const openingFt = wallOpenings.filter((o) => o.kind !== "window").reduce((s, o) => s + widthOf(o), 0);
  const extraSqFt = shape.extraWalls.reduce((s, w) => s + w.lengthFt * w.heightFt * w.faces, 0);
  const extraFt = shape.extraWalls.filter((w) => w.heightFt > 1).reduce((s, w) => s + w.lengthFt, 0);
  const wallGrossSqFt = walledFt * shape.ceilingFt;
  return {
    floorSqFt: shoelaceSqFt(shape.polygonFt),
    perimeterFt,
    walledFt,
    wallLengthsFt: lengths.map((l, i) => (shape.glassEdges.includes(i) ? 0 : l)),
    wallGrossSqFt,
    openingSqFt,
    extraSqFt,
    hiddenSqFt: shape.hiddenSqFt,
    /** The painted wall area. */
    paintSqFt: wallGrossSqFt - openingSqFt + extraSqFt - shape.hiddenSqFt,
    /** The bottom of the walls, door widths off: where her small damage is. */
    baseRunFt: walledFt - openingFt + extraFt,
    doorCount: shape.openingsFt.filter((o) => o.kind === "door").length,
    windowCount: shape.openingsFt.filter((o) => o.kind === "window").length,
  };
}

/**
 * The flight between the floors, which no room's walls carry: the wall
 * between the two flights on the stair side (≈ 5'-6" on average above the
 * stringer over its 9'-9"), and through the opening the walls from the hall
 * ceiling up to the upper floor — the west one on up the half-wall's stair
 * face (7'-10" × 4'-6"), the east one to the floor edge (7'-10" × 1') — and
 * the north half-wall's stair face (3'-1" × 4'-6").
 */
export const STAIRWELL = {
  runFt: 9.74,
  openingFt: 7.79,
  parts: [
    { label: "Mur entre les volées", sqft: 9.74 * 5.5 },
    { label: "Mur ouest dans l'ouverture", sqft: 7.79 * 4.5 },
    { label: "Mur est dans l'ouverture", sqft: 7.79 * 1 },
    { label: "Muret nord côté escalier", sqft: 3.07 * 4.5 },
  ],
};
export const stairwellSqFt = () => STAIRWELL.parts.reduce((s, p) => s + p.sqft, 0);

export function planObjects(shape: GarderieRoomShape): Array<{ id: string; kind: string; name: string; x: number; y: number; rotation: number; widthM: number; depthM: number }> {
  return shape.objects.map((o, i) => ({
    id: `${roomId(shape.key)}-obj-${i}`,
    kind: o.kind,
    name: o.name,
    x: m(o.atFt.x),
    y: m(o.atFt.y),
    rotation: o.rotation,
    widthM: m(o.widthFt),
    depthM: m(o.depthFt),
  }));
}

export function estimateRooms(): EstimateRoom[] {
  return ROOM_SHAPES.map((shape): EstimateRoom => {
    const f = roomFigures(shape);
    const objects: RoomObject[] = [];
    return {
      roomScanId: roomId(shape.key),
      name: shape.name,
      stats: {
        level: shape.level,
        floorAreaSqm: sqm(f.floorSqFt),
        perimeterM: m(f.perimeterFt),
        ceilingHeightM: m(shape.ceilingFt),
        wallAreaGrossSqm: sqm(f.wallGrossSqFt),
        wallAreaNetSqm: sqm(f.paintSqFt),
        doorCount: f.doorCount,
        windowCount: f.windowCount,
      },
      wallLengthsM: f.wallLengthsFt.map(m),
      baseboardLengthM: m(f.baseRunFt),
      floorFinish: null,
      affectedAreas: [],
      objects,
    };
  });
}

export { m as feetToMetres, sqm as sqftToSqm };
