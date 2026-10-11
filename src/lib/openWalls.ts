import { wallLengthM } from "./crm/areaShapes";
import {
  planCorners,
  toFloorPlan,
  totalWallLengthMeters,
  type FloorPlan,
  type PlanPoint,
  type PlanSegment,
  type ScanGeometry,
} from "./roomScan";

/**
 * Open sides — an edge of a room's outline with no wall standing on it.
 *
 * An open-plan entry that runs straight into the dining room still has a
 * boundary: that is where one room's floor area stops and the next one's
 * starts. What it does not have is a wall. Nothing to paint, nothing to hang
 * board on, no baseboard along it. magicplan calls the same thing a
 * separator. Here it is a flag on the wall's own record (`room_walls.is_open`),
 * keyed by edge index like every other per-wall fact.
 *
 * Opening a side never changes the floor: the outline stays closed, the area
 * inside it is the same area. It changes the walls, and only through the
 * perimeter — the stored `wall_length_m` that wall area (perimeter × height)
 * and baseboard (perimeter − doorways) are both derived from, by the web, the
 * report, the estimate and the phone alike. So the perimeter is the one
 * number this module moves, and every one of those follows it.
 */

/** Edge `i` of this outline — the indexing every per-wall record counts in. */
export function outlineCorners(geometry: ScanGeometry): PlanPoint[] {
  return planCorners(toFloorPlan(geometry));
}

function validIndices(openWalls: readonly number[] | null | undefined, count: number): number[] {
  return [...new Set(openWalls ?? [])].filter((i) => Number.isInteger(i) && i >= 0 && i < count);
}

/** Total length of the open sides, in metres. Indices that no longer name an
    edge (an outline corrected down to fewer corners) count for nothing. */
export function openWallLengthMeters(
  geometry: ScanGeometry,
  openWalls: readonly number[] | null | undefined,
): number {
  const corners = outlineCorners(geometry);
  if (corners.length < 3) return 0;
  return validIndices(openWalls, corners.length).reduce(
    (sum, i) => sum + wallLengthM(corners, i),
    0,
  );
}

/**
 * The perimeter with every wall standing — what `wall_length_m` holds before
 * any side is opened. Mirrors the column's two writers: the corrected outline
 * when a plan was edited by hand (`saveEditedPolygon`), the scan's own walls
 * otherwise (a phone scan, or the tape-measure entry).
 */
export function closedPerimeterMeters(geometry: ScanGeometry): number {
  const edited = geometry.editedPolygon;
  if (edited && edited.length >= 3) {
    return edited.reduce((sum, a, i) => {
      const b = edited[(i + 1) % edited.length];
      return sum + Math.hypot(b.x - a.x, b.y - a.y);
    }, 0);
  }
  return totalWallLengthMeters(geometry);
}

/** The perimeter the walls actually run: every side except the open ones. */
export function perimeterWithOpenWallsMeters(
  geometry: ScanGeometry,
  openWalls: readonly number[] | null | undefined,
): number {
  return Math.max(0, closedPerimeterMeters(geometry) - openWallLengthMeters(geometry, openWalls));
}

function onEdge(s: PlanSegment, a: PlanPoint, b: PlanPoint, tolerance: number): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  if (length < 1e-6) return false;
  const along = (x: number, y: number) => ((x - a.x) * dx + (y - a.y) * dy) / length;
  const off = (x: number, y: number) => Math.abs((x - a.x) * dy - (y - a.y) * dx) / length;
  return [
    [s.x1, s.y1],
    [s.x2, s.y2],
  ].every(
    ([x, y]) =>
      off(x, y) < tolerance && along(x, y) > -tolerance && along(x, y) < length + tolerance,
  );
}

/**
 * Which of a plan's drawn segments stand on an open side, one flag per
 * segment.
 *
 * Matched by position, not by index. An outline corrected by hand draws one
 * segment per edge in edge order, but a scanned room draws RoomPlan's own
 * walls, which need not line up with the outline's edges one for one — a
 * long wall can be two segments, and the order is the scanner's. A segment
 * counts as open when both its ends lie on an open edge.
 */
export function openSegmentFlags(
  plan: Pick<FloorPlan, "segments" | "polygon">,
  openWalls: readonly number[] | null | undefined,
  tolerance = 0.05,
): boolean[] {
  const corners = planCorners(plan);
  const open = validIndices(openWalls, corners.length);
  if (open.length === 0 || corners.length < 3) return plan.segments.map(() => false);
  return plan.segments.map((s) =>
    open.some((i) => onEdge(s, corners[i], corners[(i + 1) % corners.length], tolerance)),
  );
}

export type WallSide = "Top" | "Right" | "Bottom" | "Left";

/**
 * Which side of the drawing an edge is on, as the operator sees it on the
 * plan above the list — "Top", not "edge 0". Plan y runs down the page.
 */
export function wallSide(corners: PlanPoint[], index: number): WallSide {
  const n = corners.length;
  const a = corners[index % n];
  const b = corners[(index + 1) % n];
  const cx = corners.reduce((s, p) => s + p.x, 0) / n;
  const cy = corners.reduce((s, p) => s + p.y, 0) / n;
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const across = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y);
  if (across) return my < cy ? "Top" : "Bottom";
  return mx < cx ? "Left" : "Right";
}
