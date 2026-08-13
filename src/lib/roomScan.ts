import { Capacitor, registerPlugin } from "@capacitor/core";

/**
 * Bridges to `RoomScanPlugin.swift` — a native-only capability, so every
 * export here is a no-op outside the app rather than an error, the same
 * convention as speakerOutput.ts and haptics.ts.
 */

/**
 * One wall. The geometry fields describe it from above: `center` is its
 * midpoint on the floor plane and `axis` is the direction it runs in, both
 * in RoomPlan's world space (metres, y is up, so the plan lives in x/z).
 * Together they're enough to draw the room, not just measure it.
 */
export type RoomScanWall = {
  lengthMeters: number;
  heightMeters: number;
  centerX: number;
  centerZ: number;
  axisX: number;
  axisZ: number;
};
export type RoomScanFloor = { areaSquareMeters: number };

/** A door or window, positioned the same way a wall is so the plan can cut
    it into the wall it sits in rather than drawing an unbroken box. */
export type RoomScanOpening = {
  widthMeters: number;
  /** Present from the merged/structure path onward; older saved scans have
      no height, and the deduction below treats those as zero rather than
      guessing a standard door. */
  heightMeters?: number;
  centerX: number;
  centerZ: number;
  axisX: number;
  axisZ: number;
};

export type RoomScanResult = {
  walls: RoomScanWall[];
  floors: RoomScanFloor[];
  doors: RoomScanOpening[];
  windows: RoomScanOpening[];
  /** Cased openings — doorless passages. The gaps that CONNECT rooms; a
      merged plan without them draws sealed boxes. Absent on scans saved
      before the plugin emitted them. */
  openings?: RoomScanOpening[];
  doorCount: number;
  windowCount: number;
  openingCount: number;
  stairCount: number;
  /** Handle to the exported 3D model held natively, or absent if the export
      failed. Never a file path — the JS side never touches the filesystem. */
  modelId?: string;
};

/** A merged floor: the same shape as a room, plus the labels the merge
    recovered for each space it recognised. */
export type MergedStructure = RoomScanResult & {
  sections?: { label: string; centerX: number; centerZ: number }[];
};

type RoomScanBridge = {
  isSupported(): Promise<{ supported: boolean }>;
  startScan(): Promise<RoomScanResult & { roomsCaptured?: number }>;
  showModel(options: { modelId: string }): Promise<{ ok: boolean }>;
  mergeScans(): Promise<MergedStructure>;
  resetScans(): Promise<{ ok: boolean }>;
  removeScan(options: { index: number }): Promise<{ roomsCaptured: number }>;
};

const RoomScan = registerPlugin<RoomScanBridge>("RoomScan");

export type ScanSupport =
  | { state: "supported" }
  | { state: "no-lidar" }
  | { state: "not-native" }
  /** The plugin didn't answer — a wiring fault in the app, not a limit of
      the phone. Kept distinct because reporting it as "no LiDAR" is how a
      missing plugin registration spent a build masquerading as a hardware
      limitation on a device that has the sensor. */
  | { state: "plugin-missing"; detail: string };

export async function roomScanSupport(): Promise<ScanSupport> {
  if (!Capacitor.isNativePlatform()) return { state: "not-native" };
  try {
    const { supported } = await RoomScan.isSupported();
    return supported ? { state: "supported" } : { state: "no-lidar" };
  } catch (err) {
    return {
      state: "plugin-missing",
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Throws on cancel or an unsupported device — the caller's catch block IS
    the "no scan happened" path, not a separate flag to check first. */
export async function scanRoom(): Promise<RoomScanResult & { roomsCaptured?: number }> {
  const result = await RoomScan.startScan();
  // Capacitor resolves with {} instead of rejecting when a payload fails
  // JSON serialization (a NaN in any Double does it). Left unchecked that
  // {} walks into `.walls.map(...)` and crashes the whole scan screen,
  // taking every unsaved room with it.
  if (!Array.isArray(result?.walls)) {
    throw new Error("The scan returned no usable geometry — try scanning the room again.");
  }
  return result;
}

/** Drop one held room from the native merge set, by capture order. Must be
    called when a room is removed on screen, or the next Combine quietly
    includes a room the operator deleted. */
export async function removeScanAt(index: number): Promise<void> {
  try {
    await RoomScan.removeScan({ index });
  } catch {
    // Out of range means native and screen already disagree; the merge
    // button's roomsCaptured check is the backstop.
  }
}

/** Open the scanned room as a 3D model — the dollhouse — in the system's
    own USDZ viewer, which brings pinch, rotate and AR placement with it. */
export async function showRoomModel(modelId: string): Promise<void> {
  await RoomScan.showModel({ modelId });
}

/**
 * Combine every room scanned on this floor into one connected plan.
 *
 * This is the step that turns a pile of separate room drawings into a plan
 * of a property — each room is captured in its own coordinate space, and
 * only the merge knows how they fit together. Needs at least two rooms.
 */
export async function mergeScans(): Promise<MergedStructure> {
  return RoomScan.mergeScans();
}

export type ScanProject = {
  id: string;
  name: string;
  clientName: string | null;
  roomCount: number;
};

/** The projects a scan can be filed against. */
export async function listScanProjects(): Promise<ScanProject[]> {
  const response = await fetch("/api/v1/projects");
  if (!response.ok) throw new Error("Could not load projects.");
  return ((await response.json()) as { projects: ScanProject[] }).projects;
}

/**
 * File a finished room against a project.
 *
 * The measurements are sent as taken — the server does not recompute them,
 * because it was not there. Metres go up the wire, matching what the
 * database stores; the imperial figures on screen are a presentation of
 * these, not a second source of truth.
 */
export async function saveScan(input: {
  projectId: string;
  name: string;
  level: string;
  position: number;
  result: RoomScanResult;
}): Promise<string> {
  const response = await fetch("/api/v1/scans", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      projectId: input.projectId,
      name: input.name,
      level: input.level,
      position: input.position,
      floorAreaSqm: totalFloorAreaSquareMeters(input.result),
      wallLengthM: totalWallLengthMeters(input.result),
      ceilingHeightM: ceilingHeightMeters(input.result),
      doorCount: input.result.doorCount,
      windowCount: input.result.windowCount,
      stairCount: input.result.stairCount,
      geometry: input.result,
    }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "Could not save the scan.");
  }
  return ((await response.json()) as { id: string }).id;
}

/** A scan as it comes back from the server — the saved form of a room. */
export type SavedScan = {
  id: string;
  name: string;
  level: string;
  position: number;
  floor_area_sqm: number;
  wall_length_m: number;
  ceiling_height_m: number;
  door_count: number;
  window_count: number;
  stair_count: number;
  geometry: RoomScanResult;
  notes?: string | null;
  /** Where this room was dragged to on the floor, or null if never placed. */
  plan_x?: number | null;
  plan_y?: number | null;
};

/** Every room saved on a project, in walking order within each floor. */
export async function listSavedScans(projectId: string): Promise<SavedScan[]> {
  const response = await fetch(`/api/v1/scans?projectId=${encodeURIComponent(projectId)}`);
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "Could not load the rooms.");
  }
  return ((await response.json()) as { scans: SavedScan[] }).scans;
}

/** Rename a saved room, or move it to another floor. */
export async function updateSavedScan(
  id: string,
  patch: {
    name?: string;
    level?: string;
    position?: number;
    notes?: string | null;
    planX?: number | null;
    planY?: number | null;
  },
): Promise<void> {
  const response = await fetch(`/api/v1/scans/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "Could not save the change.");
  }
}

export async function deleteSavedScan(id: string): Promise<void> {
  const response = await fetch(`/api/v1/scans/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "Could not remove the room.");
  }
}

/** Forget the rooms held for merging. Called when starting a new property,
    so the next job's first room isn't merged into the last job's floor. */
export async function resetScans(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await RoomScan.resetScans();
  } catch {
    // Nothing held, or no plugin — either way there is nothing to clear.
  }
}

/** Perimeter, not floor area — what a baseboard or a chair rail is priced
    against, and RoomPlan hands back individual wall segments, not a sum. */
export function totalWallLengthMeters(result: RoomScanResult): number {
  return result.walls.reduce((sum, wall) => sum + wall.lengthMeters, 0);
}

export function totalFloorAreaSquareMeters(result: RoomScanResult): number {
  return result.floors.reduce((sum, floor) => sum + floor.areaSquareMeters, 0);
}

/** The tallest wall. A room with a raked ceiling is priced off the height
    material actually has to reach, not an average. */
export function ceilingHeightMeters(result: RoomScanResult): number {
  return result.walls.reduce((tallest, wall) => Math.max(tallest, wall.heightMeters), 0);
}

/** Every door and window, as area. What a painter does not have to cover. */
export function openingAreaSquareMeters(result: RoomScanResult): number {
  const area = (list: RoomScanOpening[] | undefined) =>
    (list ?? []).reduce((sum, o) => sum + o.widthMeters * (o.heightMeters ?? 0), 0);
  return area(result.doors) + area(result.windows) + area(result.openings);
}

/**
 * Wall area, gross and net.
 *
 * `gross` is perimeter × ceiling height — every square foot of wall that
 * exists. `net` takes the doors and windows out of it, and is the figure
 * paint and drywall are actually priced on: nobody paints a doorway.
 *
 * Both are reported because they answer different questions — framing and
 * insulation care about the gross wall, finishes care about the net one —
 * and because a single "wall area" that silently picked one would be wrong
 * half the time.
 */
export function wallAreaSquareMeters(result: RoomScanResult): {
  gross: number;
  net: number;
} {
  const gross = totalWallLengthMeters(result) * ceilingHeightMeters(result);
  const net = Math.max(0, gross - openingAreaSquareMeters(result));
  return { gross, net };
}

export type PlanSegment = { x1: number; y1: number; x2: number; y2: number };
export type PlanOpening = PlanSegment & { kind: "door" | "window" | "opening" };
export type PlanPoint = { x: number; y: number };
export type FloorPlan = {
  segments: PlanSegment[];
  openings: PlanOpening[];
  /** The room's outline as an ordered loop, when the walls actually form
      one — the fill behind the walls. Empty when they don't close. */
  polygon: PlanPoint[];
  /** Bounding box in metres, for fitting the plan to whatever it's drawn in. */
  width: number;
  height: number;
  /** What was subtracted to move the plan to (0,0) — anything positioned in
      the scan's world space (section labels) needs the same shift. */
  offsetX: number;
  offsetY: number;
};

/**
 * Turn the plan so the room sits square to the page.
 *
 * A scan is measured in the coordinate frame of wherever the phone happened
 * to be standing when it started, so a perfectly rectangular room comes out
 * tilted at whatever angle that was — which reads as a bad scan even when
 * the geometry is exact. Every printed floor plan is drawn square; this is
 * how that happens.
 *
 * It is a pure rotation about the origin: no length, angle between walls, or
 * area changes, and nothing is snapped or invented. The only thing lost is
 * the arbitrary compass bearing of the person who took the scan.
 *
 * The angle comes from the LONGEST wall, because the longest wall is the one
 * a reader's eye squares the room against.
 */
function squareToPage(segments: PlanSegment[]): PlanSegment[] {
  if (segments.length === 0) return segments;

  let longest = segments[0];
  let longestLength = 0;
  for (const s of segments) {
    const length = Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
    if (length > longestLength) {
      longestLength = length;
      longest = s;
    }
  }

  // Fold onto [-45, 45]: turning a room by a quarter is the same room, and
  // the nearest quarter-turn is the least surprising one.
  let angle = Math.atan2(longest.y2 - longest.y1, longest.x2 - longest.x1);
  while (angle > Math.PI / 4) angle -= Math.PI / 2;
  while (angle < -Math.PI / 4) angle += Math.PI / 2;
  if (Math.abs(angle) < 0.005) return segments;

  const cos = Math.cos(-angle);
  const sin = Math.sin(-angle);
  return segments.map((s) => ({
    ...s,
    x1: s.x1 * cos - s.y1 * sin,
    y1: s.x1 * sin + s.y1 * cos,
    x2: s.x2 * cos - s.y2 * sin,
    y2: s.x2 * sin + s.y2 * cos,
  }));
}

/**
 * Bring walls that are already almost collinear onto one line.
 *
 * RoomPlan reports a wall interrupted by a doorway as TWO separate surfaces,
 * and each is measured independently — so the two halves of one physical
 * wall come back a few centimetres apart. Drawn literally that reads as a
 * step in the wall on either side of the door, which is the most obvious
 * thing wrong with a raw scanned plan.
 *
 * The correction is deliberately narrow. A wall is only moved when another
 * wall is BOTH near-parallel to it (within 4 degrees) AND already sits on
 * nearly the same line (within 7 cm) — which is to say, when the scan has
 * clearly measured one wall twice. Each is then slid ALONG ITS OWN NORMAL to
 * the length-weighted average line, so:
 *
 *   - nothing rotates, and no wall changes length
 *   - a genuine step in a wall, or a wall parallel to another a real
 *     distance away, is untouched — 7 cm is thinner than any real framed
 *     wall, so two walls that close together are one wall
 *   - the door between the halves moves with them, since openings are
 *     aligned against the same lines
 *
 * This is not the regularisation reverted earlier. That one snapped angles
 * and collapsed perpendicular walls into parallel; this moves nothing that
 * was not already within a wall's thickness of where it is being put.
 */
const COLLINEAR_ANGLE = (4 * Math.PI) / 180;
const COLLINEAR_OFFSET = 0.07;

type Line = { angle: number; offset: number };

/** A segment's line: direction folded onto [0, pi), and the signed
    perpendicular distance from the origin. */
function lineOf(s: PlanSegment): Line {
  let angle = Math.atan2(s.y2 - s.y1, s.x2 - s.x1);
  if (angle < 0) angle += Math.PI;
  if (angle >= Math.PI) angle -= Math.PI;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  return { angle, offset: s.x1 * dy - s.y1 * dx };
}

function alignCollinearWalls(walls: PlanSegment[], openings: PlanOpening[]): {
  walls: PlanSegment[];
  openings: PlanOpening[];
} {
  if (walls.length < 2) return { walls, openings };

  const lines = walls.map(lineOf);
  const lengths = walls.map((s) => Math.hypot(s.x2 - s.x1, s.y2 - s.y1));

  // Group walls that describe the same line. Angles near 0 and near pi are
  // the same direction, so the comparison wraps.
  const groupOf = new Array<number>(walls.length).fill(-1);
  const groups: number[][] = [];
  for (let i = 0; i < walls.length; i += 1) {
    if (groupOf[i] >= 0) continue;
    const group = [i];
    groupOf[i] = groups.length;
    for (let j = i + 1; j < walls.length; j += 1) {
      if (groupOf[j] >= 0) continue;
      let dAngle = Math.abs(lines[i].angle - lines[j].angle);
      if (dAngle > Math.PI / 2) dAngle = Math.PI - dAngle;
      if (dAngle > COLLINEAR_ANGLE) continue;
      if (Math.abs(lines[i].offset - lines[j].offset) > COLLINEAR_OFFSET) continue;
      group.push(j);
      groupOf[j] = groups.length;
    }
    groups.push(group);
  }

  // The line each group agrees on: longer walls were measured over more
  // surface and are trusted proportionally more.
  const target = new Array<number>(walls.length).fill(0);
  const targetAngle = new Array<number>(walls.length).fill(0);
  for (const group of groups) {
    const total = group.reduce((sum, i) => sum + lengths[i], 0) || 1;
    const offset = group.reduce((sum, i) => sum + lines[i].offset * lengths[i], 0) / total;
    const angle = group.reduce((sum, i) => sum + lines[i].angle * lengths[i], 0) / total;
    for (const i of group) {
      target[i] = offset;
      targetAngle[i] = angle;
    }
  }

  /** Slide a segment along its own normal by `shift`. */
  const slide = <T extends PlanSegment>(s: T, angle: number, shift: number): T => {
    const nx = Math.sin(angle);
    const ny = -Math.cos(angle);
    return { ...s, x1: s.x1 + nx * shift, y1: s.y1 + ny * shift, x2: s.x2 + nx * shift, y2: s.y2 + ny * shift };
  };

  const movedWalls = walls.map((s, i) => slide(s, lines[i].angle, target[i] - lines[i].offset));

  // Openings follow the wall they were cut from — the nearest line among
  // the groups, on the same test. An opening with no wall near enough is
  // left where the scan put it rather than dragged somewhere invented.
  const movedOpenings = openings.map((o) => {
    const line = lineOf(o);
    let best = -1;
    let bestDistance = COLLINEAR_OFFSET;
    for (let i = 0; i < walls.length; i += 1) {
      let dAngle = Math.abs(line.angle - targetAngle[i]);
      if (dAngle > Math.PI / 2) dAngle = Math.PI - dAngle;
      if (dAngle > COLLINEAR_ANGLE) continue;
      const distance = Math.abs(line.offset - target[i]);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = i;
      }
    }
    return best < 0 ? o : slide(o, line.angle, target[best] - line.offset);
  });

  return { walls: movedWalls, openings: movedOpenings };
}

/**
 * Chain wall segments into a closed outline.
 *
 * RoomPlan hands back walls in no particular order, so a fill needs them
 * sorted end-to-end first: start at one wall, repeatedly take whichever
 * remaining endpoint is nearest the current one, and stop when nothing is
 * near enough to be the same corner. `tolerance` is generous (25cm) because
 * scanned walls rarely meet exactly.
 *
 * Returns an empty array rather than a wrong shape when the walls don't
 * close — an L-shaped room scanned from one side genuinely has no outline,
 * and inventing one would draw a fill that isn't the room.
 */
function chainIntoPolygon(segments: PlanSegment[], tolerance = 0.25): PlanPoint[] {
  if (segments.length < 3) return [];

  const remaining = segments.slice(1);
  const first = segments[0];
  const points: PlanPoint[] = [
    { x: first.x1, y: first.y1 },
    { x: first.x2, y: first.y2 },
  ];

  while (remaining.length > 0) {
    const tail = points[points.length - 1];
    let bestIndex = -1;
    let bestDistance = Infinity;
    let bestEnd: PlanPoint | null = null;

    remaining.forEach((segment, index) => {
      const start = { x: segment.x1, y: segment.y1 };
      const end = { x: segment.x2, y: segment.y2 };
      const toStart = Math.hypot(start.x - tail.x, start.y - tail.y);
      const toEnd = Math.hypot(end.x - tail.x, end.y - tail.y);
      if (toStart < bestDistance) {
        bestDistance = toStart;
        bestIndex = index;
        bestEnd = end;
      }
      if (toEnd < bestDistance) {
        bestDistance = toEnd;
        bestIndex = index;
        bestEnd = start;
      }
    });

    if (bestIndex < 0 || bestDistance > tolerance || !bestEnd) return [];
    remaining.splice(bestIndex, 1);
    points.push(bestEnd);
  }

  // The loop has to come back to where it started to be an outline at all.
  const start = points[0];
  const end = points[points.length - 1];
  if (Math.hypot(end.x - start.x, end.y - start.y) > tolerance) return [];
  return points;
}

/**
 * The walls as drawable line segments, normalised so the plan's top-left
 * corner sits at (0, 0).
 *
 * Each wall's endpoints are its centre ± half its length along its own axis.
 * RoomPlan's z grows toward the viewer while an SVG's y grows downward, so z
 * maps to y directly and the result reads as a top-down plan the right way
 * up.
 */
export function toFloorPlan(result: RoomScanResult): FloorPlan {
  const span = (
    item: { centerX: number; centerZ: number; axisX: number; axisZ: number },
    length: number,
  ) => {
    const half = length / 2;
    return {
      x1: item.centerX - item.axisX * half,
      y1: item.centerZ - item.axisZ * half,
      x2: item.centerX + item.axisX * half,
      y2: item.centerZ + item.axisZ * half,
    };
  };

  const rawWalls = result.walls.map((wall) => span(wall, wall.lengthMeters));
  if (rawWalls.length === 0) {
    return { segments: [], openings: [], polygon: [], width: 0, height: 0, offsetX: 0, offsetY: 0 };
  }

  const rawOpeningSpans: PlanOpening[] = [
    ...(result.doors ?? []).map((d) => ({ ...span(d, d.widthMeters), kind: "door" as const })),
    ...(result.windows ?? []).map((w) => ({ ...span(w, w.widthMeters), kind: "window" as const })),
    ...(result.openings ?? []).map((o) => ({ ...span(o, o.widthMeters), kind: "opening" as const })),
  ];

  // Walls and openings are rotated TOGETHER, by the angle the walls imply,
  // so a door stays in the wall it was cut from.
  const rotated = squareToPage([...rawWalls, ...rawOpeningSpans]);
  const aligned = alignCollinearWalls(
    rotated.slice(0, rawWalls.length),
    rotated.slice(rawWalls.length) as PlanOpening[],
  );
  const raw = aligned.walls;
  const rawOpenings = aligned.openings;

  // Normalise everything against the same origin, so the openings still sit
  // in their walls after the plan is moved to (0, 0).
  const xs = raw.flatMap((s) => [s.x1, s.x2]);
  const ys = raw.flatMap((s) => [s.y1, s.y2]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const shift = <T extends PlanSegment>(s: T): T => ({
    ...s,
    x1: s.x1 - minX,
    y1: s.y1 - minY,
    x2: s.x2 - minX,
    y2: s.y2 - minY,
  });

  const segments = raw.map(shift);

  return {
    segments,
    openings: rawOpenings.map(shift),
    polygon: chainIntoPolygon(segments),
    width: Math.max(...xs) - minX,
    height: Math.max(...ys) - minY,
    offsetX: minX,
    offsetY: minY,
  };
}

/** RoomPlan measures in meters; every price book unit here is imperial. */
export function metersToFeet(meters: number): number {
  return meters * 3.28084;
}

export function squareMetersToSquareFeet(squareMeters: number): number {
  return squareMeters * 10.7639;
}
