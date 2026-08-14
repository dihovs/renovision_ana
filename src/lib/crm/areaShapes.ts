/**
 * Affected areas — the shapes, colours and maths, with no database in sight.
 *
 * Split from `affectedAreas.ts` so client components (the area editor, the
 * room sheet on the phone) can import the geometry without dragging the
 * server-side Supabase client into the browser bundle. The DB functions
 * stay in `affectedAreas.ts`, which re-exports everything here so server
 * callers see one module.
 */

export const DAMAGE_TYPES = ["water", "fire", "mould", "impact", "other"] as const;
export type DamageType = (typeof DAMAGE_TYPES)[number];

export const DAMAGE_LABEL: Record<DamageType, string> = {
  water: "Water",
  fire: "Fire / smoke",
  mould: "Mould",
  impact: "Impact",
  other: "Other",
};

/**
 * The default colour per cause. Chosen to stay apart from each other and
 * from the plan's own black-on-grey, and to read at the size an area is
 * actually drawn — a thumbnail, over a floor, under a dimension line.
 */
export const DAMAGE_COLOR: Record<DamageType, string> = {
  water: "#2b7fd4",
  fire: "#e2673a",
  mould: "#4f9d3a",
  impact: "#8a63d2",
  other: "#8a8a8e",
};

export type AreaPoint = { x: number; y: number };

export type AffectedArea = {
  id: string;
  created_at: string;
  room_scan_id: string;
  surface: "floor" | "wall";
  wall_index: number | null;
  name: string;
  damage_type: DamageType;
  color: string | null;
  area_sqm: number;
  polygon: AreaPoint[];
  notes: string | null;
};

export type AffectedAreaInput = {
  roomScanId: string;
  surface?: "floor" | "wall";
  wallIndex?: number | null;
  name?: string;
  damageType?: DamageType;
  color?: string | null;
  polygon: AreaPoint[];
  notes?: string | null;
};

/**
 * The area of a simple polygon, by the shoelace formula.
 *
 * Absolute value, so a shape drawn clockwise measures the same as one drawn
 * anticlockwise — the operator dragging corners has no idea which way round
 * they are going, and should not have to.
 *
 * Self-intersecting shapes (a bow-tie) are not meaningful here and this will
 * under-report them; the editor prevents making one rather than the maths
 * pretending to handle it.
 */
export function polygonAreaSqm(points: AreaPoint[]): number {
  if (points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

/** The colour an area is drawn in: its own override, else its cause's. */
export function areaColor(area: Pick<AffectedArea, "color" | "damage_type">): string {
  return area.color ?? DAMAGE_COLOR[area.damage_type] ?? DAMAGE_COLOR.other;
}

/**
 * Damaged area totalled by cause.
 *
 * By cause rather than one grand total because the causes do not share a
 * trade or a rate — and because areas may overlap, a single sum across all
 * of them would double-count the square footage where a wall is both wet
 * and smoke-stained.
 */
export function totalsByDamageType(areas: AffectedArea[]): { type: DamageType; sqm: number }[] {
  const totals = new Map<DamageType, number>();
  for (const area of areas) {
    totals.set(area.damage_type, (totals.get(area.damage_type) ?? 0) + Number(area.area_sqm));
  }
  return DAMAGE_TYPES.filter((type) => totals.has(type)).map((type) => ({
    type,
    sqm: totals.get(type) ?? 0,
  }));
}
