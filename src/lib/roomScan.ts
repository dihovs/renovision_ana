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

  const raw = result.walls.map((wall) => span(wall, wall.lengthMeters));
  if (raw.length === 0) {
    return { segments: [], openings: [], polygon: [], width: 0, height: 0, offsetX: 0, offsetY: 0 };
  }

  const rawOpenings: PlanOpening[] = [
    ...(result.doors ?? []).map((d) => ({ ...span(d, d.widthMeters), kind: "door" as const })),
    ...(result.windows ?? []).map((w) => ({ ...span(w, w.widthMeters), kind: "window" as const })),
    ...(result.openings ?? []).map((o) => ({ ...span(o, o.widthMeters), kind: "opening" as const })),
  ];

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
