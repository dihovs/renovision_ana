// SDC H1 Phase 3 — 122 boul. Hymus, Pointe-Claire. Three stacked condo units
// (302, 202, 102) with one water loss running down through them.
//
// The source is Polygon Après Sinistre's devis 1641745-SDC-H1 (8 Oct 2026,
// Xactimate, price list QCMO8X_OCT26), which the owner handed over on
// 14 Oct 2026 with: "create our estimation, follow with all our rules, with
// the floor plan, with the separate rooms … with our pricing … we cannot
// undercut them." So everything MEASURED here is theirs and everything PRICED
// is ours: their sketch gives the rooms, their line items and photographs give
// where the damage is and how big; our rules and our catalogue turn that into
// money (hymus.sample.test.ts), and our report prints it
// (src/components/admin/hymus-report.render.test.tsx).
//
// This module is the one place the job's facts live, so the devis and the
// report cannot describe two different jobs.
//
// ---------------------------------------------------------------------------
// The rooms — read off the sketch's VECTORS, not traced by eye.
//
// Their sketch pages (87–89 of the photo edition) are vector drawings: every
// wall is two stroked lines 5,04 pt apart. Measured on the page, the inner
// face of the 21'10" wall is 332,8 pt long, which makes the drawing 15,24 pt
// to the foot, and every other printed dimension agrees with that scale to
// the inch (8'5", 6'4", 10'3", 16'7", 3'6", 5'1", 9'1", 5'5"). The polygons
// below are those inner faces, the page turned a quarter clockwise so the
// sketch's text reads upright, in feet from the open area's top-left.
//
// Checked against what their devis prints for each room:
//   Aire ouverte / cuisine  363,4 pi² traced  · 363,79 printed · 93,7 / 93,83 pi lin.
//   Salle de lavage          16,1 pi² traced  ·  16,10 printed · 16,5 / 16,50
//   Salle de bains           49,2 pi² traced  ·  49,20 printed · 29,0 / 29,00
//
// Verified 14 Oct 2026 by machine, not by eye: every one of our wall edges
// lies on one of their drawn lines and every opening on a gap in them, door
// widths read from the jamb lines (a first pass read the bathroom door as
// the 2'11" gap to the next wall and missed its 3" return; it is 2'6"), and
// the three units' sketches are identical line for line (125 + 48 lines).
//
// The three units are the same plan stacked (identical printed figures; the
// 202 and 102 sketches are the 302 sketch turned half round), so one geometry
// serves all three.

import type { AffectedArea } from "../../crm/areaShapes";
import type { RoomObject } from "../../crm/roomObjects";
import type { EstimateRoom } from "./types";

const FT = 0.3048;
const m = (feet: number) => feet * FT;
const sqm = (sqft: number) => sqft * FT * FT;

export type Pt = { x: number; y: number };

/** A door/opening on a room's own outline, in that room's feet. `hinge` and
    `opens` are read off the sketch's door symbols (the leaf is drawn from its
    hinge, on the side it swings to). */
type Opening = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  kind: "door" | "opening";
  hinge?: "start" | "end";
  opens?: "in" | "out";
};

export type JobRoomShape = {
  key: "open" | "laundry" | "bath";
  name: string;
  roomType: string;
  /** Outline in feet, clockwise, the room's own top-left at the origin. */
  polygonFt: Pt[];
  openingsFt: Opening[];
  /** Where the room's top-left sits on the storey, feet. */
  atFt: Pt;
};

// The open area's bottom wall carries three openings (entry door, bathroom
// door, laundry bi-fold), so it is split at their jambs — the way the source
// sketch dimensions it, wall segment by wall segment. A wall index then names
// a real wall, and the baseboard that comes off the 3-foot wall between the
// bathroom and the laundry is billed as 3 feet, not as the 30-foot run.
const OPEN_POLYGON_FT: Pt[] = [
  { x: 21.835, y: 0 }, //      0 → top of the dining bump (8'5")
  { x: 30.252, y: 0 }, //      1 → right wall (16'7")
  { x: 30.252, y: 16.583 }, // 2 → wall right of the laundry, to its door jamb (3'8")
  { x: 26.583, y: 16.583 }, // 3 → laundry bi-fold, clear opening between jambs (4'9")
  { x: 21.835, y: 16.583 }, // 4 → wall from the laundry jamb to the bathroom door (3'2")
  { x: 18.669, y: 16.583 }, // 5 → bathroom door (2'6")
  { x: 16.165, y: 16.583 }, // 6 → wall between bathroom door and entry (1'4")
  { x: 14.835, y: 16.583 }, // 7 → entry door (2'6")
  { x: 12.339, y: 16.583 }, // 8 → wall left of the entry (12'4")
  { x: 0, y: 16.583 }, //      9 → left end wall (10'3")
  { x: 0, y: 6.331 }, //      10 → long wall (21'10")
  { x: 21.835, y: 6.331 }, // 11 → side of the bump (6'4")
];

export const ROOM_SHAPES: JobRoomShape[] = [
  {
    key: "open",
    name: "Aire ouverte / cuisine",
    roomType: "kitchen",
    polygonFt: OPEN_POLYGON_FT,
    openingsFt: [
      // Laundry bi-fold: an opening on both rooms' plans.
      { x1: 26.583, y1: 16.583, x2: 21.835, y2: 16.583, kind: "opening" },
      // Bathroom door: the leaf belongs to the bathroom (it swings in there),
      // so this side shows the gap only — drawn on both rooms, the one door
      // printed twice, swinging both ways.
      { x1: 18.669, y1: 16.583, x2: 16.165, y2: 16.583, kind: "opening" },
      // Entry door: hung on the bathroom-side jamb and drawn swinging OUT to
      // the corridor, exactly as their sketch draws it.
      { x1: 14.835, y1: 16.583, x2: 12.339, y2: 16.583, kind: "door", hinge: "start", opens: "out" },
    ],
    atFt: { x: 0, y: 0 },
  },
  {
    key: "laundry",
    name: "Salle de lavage",
    roomType: "laundry",
    // 5'1" × 3'2". Edge 0 is the bi-fold side onto the open area, edge 3 the
    // wall it shares with the bathroom (the plumbing wall).
    polygonFt: [
      { x: 0, y: 0 },
      { x: 5.079, y: 0 },
      { x: 5.079, y: 3.165 },
      { x: 0, y: 3.165 },
    ],
    // Bi-fold doors: drawn as an opening, not a hinged swing. The clear
    // opening is 4'9" between 2" jambs, not the 5'1" wall it sits in.
    openingsFt: [{ x1: 0.166, y1: 0, x2: 4.914, y2: 0, kind: "opening" }],
    atFt: { x: 21.669, y: 17.0 },
  },
  {
    key: "bath",
    name: "Salle de bains",
    roomType: "bathroom",
    // 5'5" × 9'1". Edge 0 carries the door onto the open area; edge 1 is the
    // wall the vanity, toilet and wall cabinets stand on (shared with the
    // laundry); the tub runs across edge 2.
    polygonFt: [
      { x: 0, y: 0 },
      { x: 5.41, y: 0 },
      { x: 5.41, y: 9.087 },
      { x: 0, y: 9.087 },
    ],
    // 2'6", hung on the laundry-side jamb, swinging into the bathroom, with a
    // 3" return between its other jamb and the bathroom's corner (their
    // sketch: jamb lines at 342,00 and 380,16 pt).
    openingsFt: [{ x1: 0.244, y1: 0, x2: 2.748, y2: 0, kind: "door", hinge: "end", opens: "in" }],
    atFt: { x: 15.921, y: 16.913 },
  },
];

/** Door leaf height on every opening — the sketch draws none; 6'8" standard. */
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

// ---------------------------------------------------------------------------
// The units, their ceilings, and the damage.

export type JobUnit = {
  apartment: string;
  level: string;
  /** Ceiling per room, feet — printed on their devis where the room appears
      there; the unit's other rooms take the unit's printed figure. */
  ceilingFt: Record<JobRoomShape["key"], number>;
};

export const UNITS: JobUnit[] = [
  // Printed: Aire ouverte 8'10". Laundry and bathroom are not in their devis.
  { apartment: "302", level: "3rd Floor", ceilingFt: { open: 8 + 10 / 12, laundry: 8 + 10 / 12, bath: 8 + 10 / 12 } },
  // Printed: Aire ouverte 8'10", Salle de lavage 8'10".
  { apartment: "202", level: "2nd Floor", ceilingFt: { open: 8 + 10 / 12, laundry: 8 + 10 / 12, bath: 8 + 10 / 12 } },
  // Printed: Salle de lavage 8', Salle de bains 8'. Open area not in their devis.
  { apartment: "102", level: "1st Floor", ceilingFt: { open: 8, laundry: 8, bath: 8 } },
];

export function roomId(apartment: string, key: JobRoomShape["key"]): string {
  return `hymus-${apartment}-${key}`;
}

type AreaSpec = {
  surface: AffectedArea["surface"];
  wallIndex?: number;
  name: string;
  sqft: number;
  /** Floor/ceiling: a rectangle in the room's plan feet. Wall: a rectangle on
      the wall face, feet along the wall from its start × feet up. */
  rectFt: [number, number, number, number];
  notes: string;
  /** Opened by the other firm during the emergency — nothing left to remove. */
  alreadyOpen: boolean;
};

/**
 * Where the damage is, unit by unit, from their scope lines and photographs.
 * Every figure is a quantity THEY measured; where on the room it sits comes
 * from the photographs (approximate — their sketch marks no damage).
 */
export const DAMAGE: Record<string, AreaSpec[]> = {
  // Unit 302 — "Deux ouvertures effectuer pendant l'urgence" (10 pi² of 5/8"
  // ceiling, material only) in the entry corridor (photos 2–4, 7, 13, 17,
  // 23–24), plus a 3-foot strip of wall at floor level, 4" high, behind the
  // baseboard, with its insulation (photos 20, 25–26).
  [roomId("302", "open")]: [
    {
      surface: "ceiling",
      name: "Ouverture au plafond n° 1",
      sqft: 5,
      rectFt: [16.0, 14.2, 18.5, 16.2],
      notes: "Ouverture faite pendant l'urgence (couverte de polyéthylène). Placoplâtre 5/8 po à refermer.",
      alreadyOpen: true,
    },
    {
      surface: "ceiling",
      name: "Ouverture au plafond n° 2",
      sqft: 5,
      rectFt: [21.0, 14.2, 23.5, 16.2],
      notes: "Ouverture faite pendant l'urgence (couverte de polyéthylène). Placoplâtre 5/8 po à refermer.",
      alreadyOpen: true,
    },
    {
      surface: "wall",
      wallIndex: 4,
      name: "Bas du mur derrière la plinthe",
      sqft: 1,
      rectFt: [0, 0, 3, 1 / 3],
      notes: "Bande de 3 pi × 4 po au bas du mur, isolant inclus; plinthe enlevée.",
      alreadyOpen: true,
    },
  ],
  // Unit 202 — one ceiling opening, 4 pi² (photos 1, 8, 10), opened during the
  // emergency.
  [roomId("202", "open")]: [
    {
      surface: "ceiling",
      name: "Ouverture au plafond",
      sqft: 4,
      rectFt: [16.0, 14.2, 18.0, 16.2],
      notes: "Ouverture faite pendant l'urgence (couverte de polyéthylène). Placoplâtre 5/8 po à refermer.",
      alreadyOpen: true,
    },
  ],
  // Unit 202 laundry — 4 pi² of wall with its insulation, on the plumbing wall
  // shared with the bathroom; 3 pi of baseboard.
  [roomId("202", "laundry")]: [
    {
      surface: "wall",
      wallIndex: 3,
      name: "Mur mitoyen salle de bains",
      sqft: 4,
      rectFt: [0.6, 0, 2.6, 2],
      notes: "Isolant et placoplâtre à remplacer au bas du mur; plinthe enlevée.",
      alreadyOpen: true,
    },
  ],
  // Unit 102 laundry — a 4 pi² ceiling opening (photo 3) and 4 pi² of wall
  // with its insulation; their devis notes the drywall minimum "couvre
  // l'unité".
  [roomId("102", "laundry")]: [
    {
      surface: "ceiling",
      name: "Ouverture au plafond",
      sqft: 4,
      rectFt: [1.5, 0.6, 3.5, 2.6],
      notes: "Ouverture faite pendant l'urgence (couverte de polyéthylène).",
      alreadyOpen: true,
    },
    {
      surface: "wall",
      wallIndex: 2,
      name: "Mur du fond",
      sqft: 4,
      rectFt: [1.0, 0, 3.0, 2],
      notes: "Isolant et placoplâtre à remplacer au bas du mur; plinthe enlevée.",
      alreadyOpen: true,
    },
  ],
  // Unit 102 bathroom — their cover note: the wall cabinets and the vanity come
  // off because "le mur de gypse a absorbé une quantité importante d'eau",
  // with a check for mould behind them. 45 pi² of wall drywall and insulation
  // out and back on the fixture wall, and 4 pi² of ceiling out and back.
  [roomId("102", "bath")]: [
    {
      surface: "ceiling",
      name: "Plafond taché",
      sqft: 4,
      rectFt: [1.5, 3.0, 3.5, 5.0],
      notes: "Placoplâtre 5/8 po à enlever et remplacer.",
      alreadyOpen: false,
    },
    {
      surface: "wall",
      wallIndex: 1,
      name: "Mur de la vanité et de la toilette",
      sqft: 45,
      rectFt: [0, 0, 9, 5],
      notes:
        "Le mur de gypse a absorbé une quantité importante d'eau : armoires murales et vanité détachées, placoplâtre et isolant enlevés et remplacés, vérification de moisissure derrière.",
      alreadyOpen: false,
    },
  ],
};

/** Fixtures in the 102 bathroom, from photographs 1, 6–11 and their scope. */
export const BATH_102_OBJECTS: Array<{
  kind: string;
  name: string;
  disposition: RoomObject["disposition"];
  widthFt: number;
  depthFt: number;
  /** Centre, in the bathroom's own feet. */
  atFt: Pt;
  rotation: number;
}> = [
  { kind: "vanity_cabinet", name: "Vanité avec comptoir", disposition: "reset", widthFt: 2.5, depthFt: 1.75, atFt: { x: 4.53, y: 1.6 }, rotation: 90 },
  { kind: "toilet", name: "Toilette", disposition: "reset", widthFt: 1.6, depthFt: 2.3, atFt: { x: 4.25, y: 4.3 }, rotation: 90 },
  // Wall cabinets over the toilet: their scope bills 3 pi lin.
  { kind: "wall_cabinet", name: "Armoires murales", disposition: "reset", widthFt: 3, depthFt: 1, atFt: { x: 4.91, y: 4.3 }, rotation: 90 },
  { kind: "bathtub", name: "Baignoire", disposition: "none", widthFt: 5, depthFt: 2.5, atFt: { x: 2.705, y: 7.837 }, rotation: 0 },
];

// ---------------------------------------------------------------------------
// Builders.

export function areasFor(id: string): AffectedArea[] {
  return (DAMAGE[id] ?? []).map((spec, i) => {
    const [x0, y0, x1, y1] = spec.rectFt;
    // Wall faces wind anticlockwise from bottom-left with y up; plan
    // rectangles wind clockwise on screen. Either way four corners.
    const polygon = [
      { x: m(x0), y: m(y0) },
      { x: m(x1), y: m(y0) },
      { x: m(x1), y: m(y1) },
      { x: m(x0), y: m(y1) },
    ];
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
      polygon,
      // Their sketch marks no damage: where each area sits is placed from
      // their photographs, and the document says so.
      notes: `${spec.notes} Emplacement approximatif, d'après les photos.`,
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

export function objectsFor(id: string): RoomObject[] {
  if (id !== roomId("102", "bath")) return [];
  return BATH_102_OBJECTS.map((o, i) => ({
    id: `${id}-obj-${i + 1}`,
    roomScanId: id,
    kind: o.kind,
    name: o.name,
    x: m(o.atFt.x),
    y: m(o.atFt.y),
    rotation: o.rotation,
    width: m(o.widthFt),
    depth: m(o.depthFt),
    height: 0,
    disposition: o.disposition,
    included: o.disposition !== "none",
    quantity: 1,
    sizeHandSet: false,
    notes: null,
  }));
}

/** The figures a rule may cite, computed once from the outline. */
export function roomFigures(shape: JobRoomShape, ceilingFt: number) {
  const lengths = edgeLengthsFt(shape.polygonFt);
  const perimeterFt = lengths.reduce((s, l) => s + l, 0);
  const openingWidthsFt = shape.openingsFt.map((o) => Math.hypot(o.x2 - o.x1, o.y2 - o.y1));
  const openingsSqFt = openingWidthsFt.reduce((s, w) => s + w * DOOR_HEIGHT_FT, 0);
  return {
    floorSqFt: shoelaceSqFt(shape.polygonFt),
    perimeterFt,
    wallLengthsFt: lengths,
    wallGrossSqFt: perimeterFt * ceilingFt,
    wallNetSqFt: perimeterFt * ceilingFt - openingsSqFt,
    baseboardFt: perimeterFt - openingWidthsFt.reduce((s, w) => s + w, 0),
    doorCount: shape.openingsFt.length,
  };
}

export function estimateRooms(): EstimateRoom[] {
  return UNITS.flatMap((unit) =>
    ROOM_SHAPES.map((shape): EstimateRoom => {
      const id = roomId(unit.apartment, shape.key);
      const ceilingFt = unit.ceilingFt[shape.key];
      const f = roomFigures(shape, ceilingFt);
      return {
        roomScanId: id,
        name: shape.name,
        apartment: unit.apartment,
        stats: {
          level: unit.level,
          floorAreaSqm: sqm(f.floorSqFt),
          perimeterM: m(f.perimeterFt),
          ceilingHeightM: m(ceilingFt),
          wallAreaGrossSqm: sqm(f.wallGrossSqFt),
          wallAreaNetSqm: sqm(f.wallNetSqFt),
          doorCount: f.doorCount,
          windowCount: 0,
        },
        wallLengthsM: f.wallLengthsFt.map(m),
        baseboardLengthM: m(f.baseboardFt),
        // Hardwood in the open areas (photographs); their devis leaves every
        // floor "NON AFFECTÉ", so no floor line derives either way.
        floorFinish: null,
        affectedAreas: areasFor(id),
        objects: objectsFor(id),
      };
    }),
  );
}

export { m as feetToMetres, sqm as sqftToSqm };
