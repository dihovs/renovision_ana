// SDC du 7027 Clark — 7027 rue Clark, Montréal. Unit 5: a leak from the
// drain of unit 7's bath came through unit 5's bathroom ceiling and down the
// hall wall.
//
// The source is Lauresco's devis 3674_7027C_R (21 Sep 2026, Xactimate,
// price list QCMO8X_AUG26, 2 210,64 $), handed over by the owner on 19 Oct
// 2026. As with Hymus: what is MEASURED here is theirs, what is PRICED is
// ours (clark.devis.ts), and our report prints it
// (src/components/admin/clark-report.render.test.tsx).
//
// ---------------------------------------------------------------------------
// The rooms — read off the sketch's vectors (page 8, landscape, upright).
//
// Walls are line pairs 12,1 pt apart. The bathroom's inner long face is
// 410,1 pt = 11'4", so the drawing is 36,19 pt to the foot, and every other
// printed figure agrees: 5'5" and 12' × 6'1" (bathroom inside and out),
// 16', 2'3", 4'3" (the hall's open sides), 4'2", 2', 3'9", and 4" walls.
// Checked against their figures:
//   Salle de bains  61,39 pi² traced · 61,39 printed (its paint and protection)
//   Aire ouverte    44,36 pi² traced · 44,33 printed (105,72 − 61,39)
// The hall ("Aire ouverte") is only the corridor outside the bathroom: their
// own room carries three "Mur manquant … Ouvre sur Extérieur" — 16', 4'3" and
// 2'3" — so three of its sides are open, not walls.

import type { AffectedArea } from "../../crm/areaShapes";
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
  kind: "door" | "opening";
  hinge?: "start" | "end";
  opens?: "in" | "out";
};

export type ClarkRoomShape = {
  key: "bath" | "hall";
  name: string;
  roomType: string;
  polygonFt: Pt[];
  openingsFt: Opening[];
  /** Edges with no wall: open into the rest of the unit. */
  openEdges: number[];
  atFt: Pt;
  ceilingFt: number;
};

export const UNIT = "Unité 5";
/** Their sketch draws every wall 4". */
export const WALL_THICKNESS_M = (4 / 12) * FT;

export const ROOM_SHAPES: ClarkRoomShape[] = [
  {
    key: "bath",
    name: "Salle de bains",
    roomType: "bathroom",
    // 11'4" × 5'5". Edge 2 (bottom, run right to left) carries the door onto
    // the hall: 2'6", hung on its left jamb, swinging into the bathroom.
    polygonFt: [
      { x: 0, y: 0 },
      { x: 11.333, y: 0 },
      { x: 11.333, y: 5.421 },
      { x: 0, y: 5.421 },
    ],
    openingsFt: [{ x1: 1.832, y1: 5.421, x2: 4.333, y2: 5.421, kind: "door", hinge: "start", opens: "in" }],
    openEdges: [],
    atFt: { x: 0, y: 0 },
    ceilingFt: 8,
  },
  {
    key: "hall",
    name: "Aire ouverte",
    roomType: "hallway",
    // The corridor along the bathroom's outside: its top is the bathroom's
    // bottom wall (with the bathroom door), edge 1 the 2' wall where the
    // bathroom's side wall meets the hall — the damaged one — and edge 2 the
    // 4'2" wall beyond it. Edges 3–5 are the open sides.
    polygonFt: [
      { x: 0, y: 2.004 }, //      0 → bathroom's bottom wall (11'10")
      { x: 11.837, y: 2.004 }, // 1 → the 2' wall
      { x: 11.837, y: 0 }, //     2 → the 4'2" wall
      { x: 16.007, y: 0 }, //     3 → open (4'3")
      { x: 16.007, y: 4.252 }, // 4 → open (16')
      { x: 0, y: 4.252 }, //      5 → open (2'3")
    ],
    // The bathroom's door, seen from the hall: the leaf is the bathroom's.
    openingsFt: [{ x1: 2.003, y1: 2.004, x2: 4.504, y2: 2.004, kind: "opening" }],
    openEdges: [3, 4, 5],
    atFt: { x: -0.171, y: 3.75 },
    ceilingFt: 8,
  },
];

const DOOR_HEIGHT_FT = 6 + 8 / 12;

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

export function roomId(key: ClarkRoomShape["key"]): string {
  return `clark-5-${key}`;
}

/** Figures a rule may cite. Open sides carry no wall and no baseboard. */
export function roomFigures(shape: ClarkRoomShape) {
  const lengths = edgeLengthsFt(shape.polygonFt);
  const walledFt = lengths.reduce((s, l, i) => (shape.openEdges.includes(i) ? s : s + l), 0);
  const widths = shape.openingsFt.map((o) => Math.hypot(o.x2 - o.x1, o.y2 - o.y1));
  return {
    floorSqFt: shoelaceSqFt(shape.polygonFt),
    perimeterFt: walledFt,
    wallLengthsFt: lengths.map((l, i) => (shape.openEdges.includes(i) ? 0 : l)),
    wallGrossSqFt: walledFt * shape.ceilingFt,
    wallNetSqFt: walledFt * shape.ceilingFt - widths.reduce((s, w) => s + w * DOOR_HEIGHT_FT, 0),
    baseboardFt: walledFt - widths.reduce((s, w) => s + w, 0),
    doorCount: shape.openingsFt.length,
  };
}

type AreaSpec = {
  surface: AffectedArea["surface"];
  wallIndex?: number;
  name: string;
  sqft: number;
  rectFt: [number, number, number, number];
  notes: string;
  alreadyOpen: boolean;
};

/** Their scope lines and their sketch's red "DOMMAGES (plafond, mur)". */
export const DAMAGE: Record<string, AreaSpec[]> = {
  // "Restauration de l'ouverture de plafond": 5 pi² of ceiling, opened during
  // the emergency, two layers of 1/2" board to close with fire-rated caulk,
  // over 16 pi² of cavity whose cellulose came out and whose framing is
  // cleaned and treated (their lines 3–8).
  [roomId("bath")]: [
    {
      surface: "ceiling",
      name: "Ouverture au plafond",
      sqft: 5,
      rectFt: [8.9, 3.0, 11.1, 5.2],
      notes:
        "Ouverture faite pendant l'urgence, sous le drain du bain de l'unité 7. Deux épaisseurs de placoplâtre 1/2 po et scellant ignifuge à refaire; cavité de 16 pi² à nettoyer, traiter et réisoler. Emplacement approximatif, d'après le croquis.",
      alreadyOpen: true,
    },
  ],
  // "Restauration des ouvertures murales (bas de mur sous plinthe)": 2 pi
  // lin. up to 4" high, on the 2' wall; the baseboard was kept on site.
  [roomId("hall")]: [
    {
      surface: "wall",
      wallIndex: 1,
      name: "Bas du mur sous la plinthe",
      sqft: 2 / 3,
      rectFt: [0, 0, 2, 1 / 3],
      notes: "Bande de 2 pi × 4 po au bas du mur, sous la plinthe conservée sur place. Emplacement d'après le croquis.",
      alreadyOpen: true,
    },
  ],
};

/** The bathroom's fixtures, from the sketch — drawn, not touched. */
export const BATH_OBJECTS: Array<{ kind: string; name: string; widthFt: number; depthFt: number; atFt: Pt; rotation: number }> = [
  { kind: "shower", name: "Douche en coin", widthFt: 3, depthFt: 3, atFt: { x: 1.5, y: 1.5 }, rotation: 0 },
  { kind: "vanity_24", name: "Vanité", widthFt: 4, depthFt: 2, atFt: { x: 5.5, y: 1.0 }, rotation: 0 },
  { kind: "toilet", name: "Toilette", widthFt: 1.5, depthFt: 2.33, atFt: { x: 7.41, y: 4.25 }, rotation: 180 },
  { kind: "bathtub", name: "Baignoire", widthFt: 5.42, depthFt: 2.5, atFt: { x: 10.08, y: 2.71 }, rotation: 90 },
];

export function areasFor(id: string): AffectedArea[] {
  return (DAMAGE[id] ?? []).map((spec, i) => {
    const [x0, y0, x1, y1] = spec.rectFt;
    return {
      id: `${id}-dmg-${i + 1}`,
      created_at: "",
      room_scan_id: id,
      surface: spec.surface,
      wall_index: spec.surface === "wall" ? (spec.wallIndex ?? 0) : null,
      name: spec.name,
      damage_type: "water",
      color: null,
      area_sqm: sqm(spec.sqft),
      polygon: [
        { x: m(x0), y: m(y0) },
        { x: m(x1), y: m(y0) },
        { x: m(x1), y: m(y1) },
        { x: m(x0), y: m(y1) },
      ],
      notes: spec.notes,
      show_dimensions: false,
    };
  });
}

export function alreadyOpen(areaId: string): boolean {
  for (const [id, specs] of Object.entries(DAMAGE)) {
    const i = specs.findIndex((_, k) => `${id}-dmg-${k + 1}` === areaId);
    if (i >= 0) return specs[i].alreadyOpen;
  }
  return false;
}

export function estimateRooms(): EstimateRoom[] {
  return ROOM_SHAPES.map((shape): EstimateRoom => {
    const id = roomId(shape.key);
    const f = roomFigures(shape);
    const objects: RoomObject[] = [];
    return {
      roomScanId: id,
      name: shape.name,
      stats: {
        level: UNIT,
        floorAreaSqm: sqm(f.floorSqFt),
        perimeterM: m(f.perimeterFt),
        ceilingHeightM: m(shape.ceilingFt),
        wallAreaGrossSqm: sqm(f.wallGrossSqFt),
        wallAreaNetSqm: sqm(f.wallNetSqFt),
        doorCount: f.doorCount,
        windowCount: 0,
      },
      wallLengthsM: f.wallLengthsFt.map(m),
      baseboardLengthM: m(f.baseboardFt),
      floorFinish: null,
      affectedAreas: areasFor(id),
      objects,
    };
  });
}

export { m as feetToMetres, sqm as sqftToSqm };
