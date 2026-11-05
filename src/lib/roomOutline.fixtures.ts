import type { ScanGeometry } from "./roomScan";

/**
 * Real-world room shapes with hand-measured answers, fed to the outline code
 * the way RoomPlan delivers them (owner, 3 Nov 2026).
 *
 * Each room is written down the way a tradesperson measures it — corner by
 * corner in feet, going round the INSIDE of the walls — so the expected
 * area and perimeter are the ones you would get with a tape. `toScan` then
 * turns that outline into RoomPlan-shaped walls (a centre, a direction and a
 * length per wall) and, optionally, roughens them the ways a real scan is
 * rough: a degree or two of tilt, a few centimetres of drift, a wall
 * reported in two pieces, a stub by a door frame, a closet's back walls
 * seen through its doorway.
 *
 * Deterministic: the noise comes from a seeded generator, so a failing case
 * fails the same way every run and can be looked at.
 */

export const FT = 0.3048;

export type Corner = { x: number; y: number };

export type RoomCase = {
  name: string;
  /** Inside corners in FEET, in order round the room. */
  cornersFt: Corner[];
  /** Walls that exist in the scan but are NOT part of this room's outline:
      partitions seen from inside, closet backs. In feet. */
  extraWallsFt?: { a: Corner; b: Corner }[];
  /** Hand answers, from the tape. */
  areaSqFt: number;
  perimeterFt: number;
  corners: number;
};

/** Every corner in this set is square unless the case says otherwise. */
export const CASES: RoomCase[] = [
  {
    name: "Rectangle 12' × 10'",
    cornersFt: [
      { x: 0, y: 0 },
      { x: 12, y: 0 },
      { x: 12, y: 10 },
      { x: 0, y: 10 },
    ],
    areaSqFt: 120,
    perimeterFt: 44,
    corners: 4,
  },
  {
    // 16 × 12 with a 6 × 5 bite out of one corner.
    name: "L-shape 16' × 12' less 6' × 5'",
    cornersFt: [
      { x: 0, y: 0 },
      { x: 16, y: 0 },
      { x: 16, y: 7 },
      { x: 10, y: 7 },
      { x: 10, y: 12 },
      { x: 0, y: 12 },
    ],
    areaSqFt: 162,
    perimeterFt: 56,
    corners: 6,
  },
  {
    // Bedroom 12 × 11 with a 6' wide, 2' deep reach-in closet that is part
    // of the room (no door on it), stepping out of the top wall.
    name: "Bedroom 12' × 11' with open 6' × 2' closet",
    cornersFt: [
      { x: 0, y: 0 },
      { x: 12, y: 0 },
      { x: 12, y: 11 },
      { x: 9, y: 11 },
      { x: 9, y: 13 },
      { x: 3, y: 13 },
      { x: 3, y: 11 },
      { x: 0, y: 11 },
    ],
    areaSqFt: 144,
    perimeterFt: 50,
    corners: 8,
  },
  {
    // 12 × 12 with a 5' × 2' closet built INTO one corner. The room's floor
    // stops at the closet's partitions; the closet's own back faces (4" of
    // stud wall behind the partitions) are what RoomPlan sees through an
    // open closet door, and they must not be mistaken for the room.
    name: "Room 12' × 12' with closet built into a corner",
    cornersFt: [
      { x: 0, y: 0 },
      { x: 12, y: 0 },
      { x: 12, y: 10 },
      { x: 7, y: 10 },
      { x: 7, y: 12 },
      { x: 0, y: 12 },
    ],
    extraWallsFt: [
      // The closet's inside faces, one stud wall (4") behind the partitions.
      { a: { x: 7.33, y: 10.33 }, b: { x: 12, y: 10.33 } },
      { a: { x: 7.33, y: 10.33 }, b: { x: 7.33, y: 12 } },
    ],
    areaSqFt: 134,
    perimeterFt: 48,
    corners: 6,
  },
  {
    // 14 × 12 with one corner cut off at 45°, 3' along each wall.
    name: "Room 14' × 12' with a 45° corner wall",
    cornersFt: [
      { x: 0, y: 0 },
      { x: 14, y: 0 },
      { x: 14, y: 9 },
      { x: 11, y: 12 },
      { x: 0, y: 12 },
    ],
    areaSqFt: 163.5,
    perimeterFt: 14 + 9 + 3 * Math.SQRT2 + 11 + 12,
    corners: 5,
  },
  {
    // A short real jog: a chimney chase 1' deep, 2' wide, on a long wall.
    // Shorter than the 30 cm corner weld — the case that weld eats.
    name: "Room 15' × 11' with a 1' chimney chase",
    cornersFt: [
      { x: 0, y: 0 },
      { x: 15, y: 0 },
      { x: 15, y: 11 },
      { x: 9, y: 11 },
      { x: 9, y: 10 },
      { x: 7, y: 10 },
      { x: 7, y: 11 },
      { x: 0, y: 11 },
    ],
    areaSqFt: 165 - 2,
    perimeterFt: 52 + 2,
    corners: 8,
  },
];

// ---------------------------------------------------------------------------
// Noise
// ---------------------------------------------------------------------------

export type Noise = {
  /** Each wall's direction off by up to this many degrees. */
  angleDeg: number;
  /** Each wall slid sideways by up to this many metres. */
  offsetM: number;
  /** Each wall's ends short or long by up to this many metres. */
  lengthM: number;
  /** Report the longest wall as two collinear pieces, as RoomPlan does
      across a doorway. */
  split: boolean;
  /** Add a 15 cm stub where a door frame meets the wall. */
  stub: boolean;
};

export const CLEAN: Noise = { angleDeg: 0, offsetM: 0, lengthM: 0, split: false, stub: false };
export const TYPICAL: Noise = { angleDeg: 1.5, offsetM: 0.03, lengthM: 0.03, split: false, stub: false };
export const ROUGH: Noise = { angleDeg: 2.5, offsetM: 0.05, lengthM: 0.06, split: true, stub: true };

/** Small, deterministic, good enough to roughen a wall. */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

type Seg = { ax: number; ay: number; bx: number; by: number };

function toWall(s: Seg) {
  const dx = s.bx - s.ax;
  const dy = s.by - s.ay;
  const len = Math.hypot(dx, dy);
  return {
    centerX: (s.ax + s.bx) / 2,
    centerZ: (s.ay + s.by) / 2,
    axisX: dx / len,
    axisZ: dy / len,
    lengthMeters: len,
    widthMeters: len,
    heightMeters: 2.44,
  };
}

/**
 * The room as RoomPlan would report it. The whole scan is also turned by an
 * arbitrary angle, because a real scan is measured from wherever the phone
 * stood and never arrives square to anything.
 */
export function toScan(room: RoomCase, noise: Noise, seed = 1): ScanGeometry {
  const rnd = seeded(seed);
  const jitter = (max: number) => (rnd() * 2 - 1) * max;
  const pts = room.cornersFt.map((c) => ({ x: c.x * FT, y: c.y * FT }));

  let segs: Seg[] = pts.map((a, i) => {
    const b = pts[(i + 1) % pts.length];
    return { ax: a.x, ay: a.y, bx: b.x, by: b.y };
  });
  for (const w of room.extraWallsFt ?? []) {
    segs.push({ ax: w.a.x * FT, ay: w.a.y * FT, bx: w.b.x * FT, by: w.b.y * FT });
  }

  if (noise.split) {
    // The longest wall, in two pieces with a 3 cm step and a 2 cm gap.
    let i = 0;
    segs.forEach((s, j) => {
      if (Math.hypot(s.bx - s.ax, s.by - s.ay) > Math.hypot(segs[i].bx - segs[i].ax, segs[i].by - segs[i].ay)) i = j;
    });
    const s = segs[i];
    const len = Math.hypot(s.bx - s.ax, s.by - s.ay);
    const ux = (s.bx - s.ax) / len;
    const uy = (s.by - s.ay) / len;
    const mid = len * 0.45;
    const step = 0.03;
    segs.splice(
      i,
      1,
      { ax: s.ax, ay: s.ay, bx: s.ax + ux * mid, by: s.ay + uy * mid },
      {
        ax: s.ax + ux * (mid + 0.02) - uy * step,
        ay: s.ay + uy * (mid + 0.02) + ux * step,
        bx: s.bx - uy * step,
        by: s.by + ux * step,
      },
    );
  }

  segs = segs.map((s) => {
    const cx = (s.ax + s.bx) / 2;
    const cy = (s.ay + s.by) / 2;
    const len = Math.hypot(s.bx - s.ax, s.by - s.ay) + jitter(noise.lengthM);
    const ang = Math.atan2(s.by - s.ay, s.bx - s.ax) + (jitter(noise.angleDeg) * Math.PI) / 180;
    const ux = Math.cos(ang);
    const uy = Math.sin(ang);
    const off = jitter(noise.offsetM);
    const ox = cx - uy * off;
    const oy = cy + ux * off;
    return { ax: ox - (ux * len) / 2, ay: oy - (uy * len) / 2, bx: ox + (ux * len) / 2, by: oy + (uy * len) / 2 };
  });

  if (noise.stub) {
    // A door-frame stub poking off the first wall, 15 cm long.
    const s = segs[0];
    const len = Math.hypot(s.bx - s.ax, s.by - s.ay);
    const ux = (s.bx - s.ax) / len;
    const uy = (s.by - s.ay) / len;
    const px = s.ax + ux * len * 0.3;
    const py = s.ay + uy * len * 0.3;
    segs.push({ ax: px, ay: py, bx: px - uy * 0.15, by: py + ux * 0.15 });
  }

  // The scan's own arbitrary frame.
  const turn = (17 * Math.PI) / 180;
  const c = Math.cos(turn);
  const sn = Math.sin(turn);
  const rot = (x: number, y: number) => ({ x: x * c - y * sn + 3, y: x * sn + y * c - 2 });
  const walls = segs.map((s) => {
    const a = rot(s.ax, s.ay);
    const b = rot(s.bx, s.by);
    return toWall({ ax: a.x, ay: a.y, bx: b.x, by: b.y });
  });

  return {
    walls,
    floors: [{ areaSquareMeters: room.areaSqFt * FT * FT }],
    doors: [],
    windows: [],
    openings: [],
    doorCount: 0,
    windowCount: 0,
    openingCount: 0,
    stairCount: 0,
  } as unknown as ScanGeometry;
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export type Score = {
  closed: boolean;
  corners: number;
  areaSqFt: number;
  perimeterFt: number;
  areaErrPct: number;
  perimeterErrPct: number;
  /** Worst corner's distance from the nearest multiple of 45°, degrees. */
  worstAngleDeg: number;
};

/** Corners of a loop, with the closing repeat and straight-through points dropped. */
export function realCorners(loop: Corner[]): Corner[] {
  let pts = loop.slice();
  if (pts.length > 1) {
    const f = pts[0];
    const l = pts[pts.length - 1];
    if (Math.hypot(f.x - l.x, f.y - l.y) < 1e-6) pts = pts.slice(0, -1);
  }
  return pts.filter((p, i) => {
    const a = pts[(i - 1 + pts.length) % pts.length];
    const b = pts[(i + 1) % pts.length];
    const t1 = Math.atan2(p.y - a.y, p.x - a.x);
    const t2 = Math.atan2(b.y - p.y, b.x - p.x);
    let d = Math.abs(t2 - t1) % (2 * Math.PI);
    if (d > Math.PI) d = 2 * Math.PI - d;
    return d > (2 * Math.PI) / 180;
  });
}

export function score(polygon: Corner[], room: RoomCase): Score {
  const pts = realCorners(polygon);
  if (pts.length < 3) {
    return {
      closed: false,
      corners: 0,
      areaSqFt: 0,
      perimeterFt: 0,
      areaErrPct: 100,
      perimeterErrPct: 100,
      worstAngleDeg: 0,
    };
  }
  let twice = 0;
  let per = 0;
  let worst = 0;
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length];
    const a = pts[(i - 1 + pts.length) % pts.length];
    twice += p.x * q.y - q.x * p.y;
    per += Math.hypot(q.x - p.x, q.y - p.y);
    let turn = Math.atan2(q.y - p.y, q.x - p.x) - Math.atan2(p.y - a.y, p.x - a.x);
    turn = (Math.abs(turn) * 180) / Math.PI;
    const off = Math.abs(turn - Math.round(turn / 45) * 45);
    worst = Math.max(worst, off);
  });
  const areaSqFt = Math.abs(twice) / 2 / (FT * FT);
  const perimeterFt = per / FT;
  return {
    closed: true,
    corners: pts.length,
    areaSqFt,
    perimeterFt,
    areaErrPct: (Math.abs(areaSqFt - room.areaSqFt) / room.areaSqFt) * 100,
    perimeterErrPct: (Math.abs(perimeterFt - room.perimeterFt) / room.perimeterFt) * 100,
    worstAngleDeg: worst,
  };
}
