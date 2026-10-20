import { Capacitor, registerPlugin } from "@capacitor/core";
import { chainOutline } from "./wallChain";

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
  /** True when `lengthMeters`/`centerX`/`centerZ` were corrected against the
      LiDAR mesh rather than left as RoomPlan's own simplified fit — see
      `WallMeshRefinement.swift`. Absent on a scan saved before this field
      existed, and on a wall the mesh did not support a confident correction
      for (not every wall gets enough mesh coverage), which is why this is
      an audit flag rather than something arithmetic depends on: every wall
      always has a `lengthMeters`, refined or not. */
  meshRefined?: boolean;
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

/**
 * The saved form of a room's geometry: what the sensor captured, plus what
 * the plan editor added afterwards. `saveEditedPolygon` on the server writes
 * the corrected outline BESIDE the sensor's walls — never over them — and
 * the Swift renderer honours it (`FloorPlanGeometry.swift`). This is the
 * same blob read back on the web, so the same fields have to exist here.
 */
export type ScanGeometry = RoomScanResult & {
  /** The outline after the operator corrected it by hand, in plan metres.
      Replaces the walls for drawing purposes — but only for drawing; the
      sensor's own record stays underneath, untouched. */
  editedPolygon?: { x: number; y: number }[];
  /** The floor's own boundary, traced from the LiDAR mesh directly rather
      than derived from RoomPlan's wall list — see
      `WallMeshRefinement.swift`'s sibling `FloorMeshRefinement.swift`. In
      raw world metres, the same frame the walls' own `centerX`/`centerZ`
      already live in. Handed over unconditionally by the phone; `toFloorPlan`
      below is what decides whether to trust it, by comparing its area
      against the wall-chained one — the Swift twin is
      `FloorPlanGeometry.plan(from:)`, and the two gates must agree. */
  meshFloorPolygon?: { x: number; y: number }[];
  /** Which edge lengths were TYPED rather than measured, by editedPolygon
      edge index — edge i runs from point i to point i+1, wrapping. */
  lockedEdges?: number[];
  editedAt?: string;
  /**
   * Door/window openings for a HAND-TRACED outline, in the SAME frame as
   * `editedPolygon` (before the plan is shifted to its own origin).
   *
   * The edited-polygon path has always drawn no openings at all — the
   * comment on `toFloorPlan` explains why: the sensor's own doors are
   * positioned against the SCAN's walls, and a corrected outline can move
   * or drop a wall that door was cut from, so replaying the old position
   * would put a door on a wall that no longer exists. That reasoning does
   * not apply here: an opening the OPERATOR placed while tracing the
   * outline is already in the traced outline's own frame, by construction,
   * and there is nothing left to disagree with.
   *
   * A traced outline with no doors drawn on it reads as a floor plan of a
   * sealed room, which is a worse approximation than a rectangle that at
   * least admits it is schematic — so a caller tracing a polygon from a
   * source sketch by hand (no sensor, no scan) can supply the door/window
   * positions it read off the same sketch, and the plan draws them.
   */
  editedOpenings?: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    kind: "door" | "window" | "opening";
    /** Which jamb the door hangs on — the same two choices the phone's door
        editor gives ("Hinge: start / end of wall"). Absent: the renderer's
        own guess. */
    hinge?: "start" | "end";
    /** Whether the leaf swings into this room or out of it ("Opens: into /
        out of this room"). Absent: into the room. A traced sketch can say
        both: Polygon's Hymus sketch hangs the bathroom door on the laundry
        side and swings the entry door out to the corridor, and a plan that
        cannot draw that disagrees with the drawing it was traced from. */
    opens?: "in" | "out";
  }[];
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
  /** The living-area vocabulary id, asked at review. Sent with the scan so
      a room lands classified rather than falling through to `other`. */
  roomType?: string | null;
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
      roomType: input.roomType ?? null,
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
  geometry: ScanGeometry;
  notes?: string | null;
  /** Where this room was dragged to on the floor, or null if never placed. */
  plan_x?: number | null;
  plan_y?: number | null;
  /** The living-area vocabulary id (`livingArea.ts` ROOM_TYPES), asked at
      capture. Null means unclassified, which the engine counts as `other`. */
  room_type?: string | null;
  /** Hand-set 0-100 living-area override, or null for the type's default. */
  living_percent?: number | null;
  /** Edges with no wall on them — open into the next room (lib/openWalls.ts).
      Drawn dashed, and already out of `wall_length_m` on the server. */
  open_walls?: number[];
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

/** Rename a saved room, move it to another floor, or reclassify it. */
export async function updateSavedScan(
  id: string,
  patch: {
    name?: string;
    level?: string;
    position?: number;
    notes?: string | null;
    planX?: number | null;
    planY?: number | null;
    /** Reclassify the room. Null puts it back to unclassified — a real
        statement ("nobody has said"), distinct from any type. */
    roomType?: string | null;
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

/**
 * Open or close one side of a room. Returns the room's new stored perimeter
 * (the run of wall that is left), or null when the room has no walls to
 * measure. The server recomputes it, so a caller never does this arithmetic.
 */
export async function setWallOpen(
  roomScanId: string,
  wallIndex: number,
  open: boolean,
): Promise<number | null> {
  const response = await fetch(`/api/v1/scans/${encodeURIComponent(roomScanId)}/walls`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wallIndex, isOpen: open }),
  });
  const body = (await response.json().catch(() => null)) as
    | { error?: string; perimeterM?: number | null }
    | null;
  if (!response.ok) throw new Error(body?.error ?? "Could not save that wall.");
  return body?.perimeterM ?? null;
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

/** The interior perimeter — the full run of wall at ceiling level. RoomPlan
    hands back individual wall segments, not a sum. */
export function totalWallLengthMeters(result: RoomScanResult): number {
  return result.walls.reduce((sum, wall) => sum + wall.lengthMeters, 0);
}

/**
 * Baseboard length — the perimeter with every doorway taken out.
 *
 * The number baseboard, shoe moulding and floor trim are actually priced
 * against, and it is NOT the perimeter: trim does not run across a doorway.
 * On a room with two doors that is most of a metre, and it is charged per
 * linear foot.
 *
 * magicplan publishes the same figure and calls it "ground perimeter", with
 * this definition (`Docs/reference/magicplan/object-model.md` §2c, quoted from
 * their own ⓘ): *the total length of all interior walls, excluding doors,
 * deducting the width of all doors on those walls.*
 *
 * What interrupts trim is anything you walk through — a door, or a cased
 * opening. A window does not. That is exactly the `sill === 0` rule from
 * ORD-24, and for a scanned room, where RoomPlan reports no sill, the same
 * split is carried by which list a surface landed in: `doors` and `openings`
 * are walked through, `windows` are not.
 *
 * Never negative: a bad scan that reports a door wider than the room it is in
 * would otherwise price a negative length.
 */
export function baseboardLengthMeters(result: RoomScanResult): number {
  const walkThrough = [...result.doors, ...(result.openings ?? [])];
  const doorways = walkThrough.reduce((sum, opening) => sum + opening.widthMeters, 0);
  return Math.max(0, totalWallLengthMeters(result) - doorways);
}

export function totalFloorAreaSquareMeters(result: RoomScanResult): number {
  // FROM THE OUTLINE where there is one. Summing RoomPlan's floor patches
  // double-counts: it reports the floor as several overlapping rectangles
  // rather than one polygon, so a room can come back holding more floor than
  // its own bounding box — impossible for a real floor, and how this was
  // found. A live report showed AREA 87.21 m² beside WIDTH 7.559 × LENGTH
  // 5.137, which multiply to 38.8.
  //
  // The Swift twin is ScanGeometry.floorAreaSquareMeters, and the two must
  // agree: the phone writes this column on save and the server recomputes it
  // on a correction, so a difference between them would show up as a room
  // whose area changed when somebody touched a wall.
  const plan = toFloorPlan(result);
  if (plan.polygon.length >= 3) {
    const area = polygonAreaSquareMeters(plan.polygon);
    if (area > 0.5) return area;
  }
  const summed = result.floors.reduce((sum, floor) => sum + floor.areaSquareMeters, 0);
  // Nothing covers more ground than it stands on.
  const extent = plan.width * plan.height;
  return extent > 0.5 ? Math.min(summed, extent) : summed;
}

/**
 * The stored floor area, distrusted.
 *
 * **The column is the record, and normally it is right** — the phone writes
 * it on save and the server recomputes it when an outline is corrected. But
 * rooms filed before 20 Aug 2026 carry a figure summed from RoomPlan's floor
 * PATCHES, which overlap, and no floor covers more ground than the box it
 * sits in. Fixing the calculation fixed new scans; it could not reach a
 * number already written down, and the report was still printing one:
 * `Total area 87.21 m²` on a room the same app measures at 38.8.
 *
 * So the drawing's own extent is used as a ceiling, not as the answer. A
 * figure that exceeds it is impossible rather than merely surprising, and an
 * impossible number on a claim is worse than a rough one — the total area is
 * the first thing an adjuster checks with a tape.
 *
 * The Swift twin is `RoomScan.floorAreaSqmTrusted`, and the two must agree.
 */
export function trustedFloorAreaSquareMeters(
  stored: number,
  geometry: ScanGeometry | null | undefined,
): number {
  if (!Number.isFinite(stored) || stored <= 0) return 0;
  if (!geometry) return stored;
  const plan = toFloorPlan(geometry);
  if (!(plan.width > 0.5) || !(plan.height > 0.5)) return stored;
  const extent = plan.width * plan.height;
  // A 2% allowance: an L-shaped room legitimately fills less than its box,
  // never more, and rounding should not trip the guard.
  if (stored <= extent * 1.02) return stored;
  if (plan.polygon.length >= 3) {
    const area = polygonAreaSquareMeters(plan.polygon);
    if (area > 0.5) return area;
  }
  return extent;
}

/** Shoelace. Absolute, so winding does not change the answer. */
export function polygonAreaSquareMeters(points: { x: number; y: number }[]): number {
  if (points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
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

/**
 * The figures for a SAVED room prefer the stored columns and derive from the
 * raw geometry only when a column is absent.
 *
 * The columns are not a cache of the geometry. When the operator corrects a
 * plan by hand, the server recomputes `floor_area_sqm` and `wall_length_m`
 * from the corrected outline (`saveEditedPolygon` in crm/roomScans.ts) and
 * the raw walls underneath become deliberately stale. The native app reads
 * the columns back (`RoomDetailView.swift`), and so does the printed report —
 * so a web screen that recomputed from `geometry` was showing a corrected
 * room its UNcorrected figures. One room, one set of numbers.
 *
 * Zero counts as absent: the columns default to 0 in the database, and a
 * genuinely zero-area room derives to zero through the fallback anyway.
 */
function columnOr(value: number | null | undefined, fallback: () => number): number {
  const v = Number(value);
  return Number.isFinite(v) && v > 0 ? v : fallback();
}

export function savedFloorAreaSquareMeters(scan: SavedScan): number {
  return columnOr(scan.floor_area_sqm, () => totalFloorAreaSquareMeters(scan.geometry));
}

/** Perimeter of a saved room — the corrected one, when the plan was edited,
    and the run of wall only: open sides are already out of the column
    (lib/openWalls.ts). One case the zero-means-absent rule above would get
    wrong: a room open on EVERY side genuinely has no wall, so its column is
    a true 0 — and a room carrying open sides with a 0 column is that room,
    not an old row, so it reads 0 rather than falling back to the outline. */
export function savedPerimeterMeters(scan: SavedScan): number {
  return columnOr(scan.wall_length_m, () =>
    scan.open_walls && scan.open_walls.length > 0 ? 0 : totalWallLengthMeters(scan.geometry),
  );
}

export function savedCeilingHeightMeters(scan: SavedScan): number {
  return columnOr(scan.ceiling_height_m, () => ceilingHeightMeters(scan.geometry));
}

/** Wall area of a saved room: corrected perimeter × ceiling height, with the
    detected openings still deducted from net — correcting an outline does
    not take the doors out of the walls. */
export function savedWallAreaSquareMeters(scan: SavedScan): { gross: number; net: number } {
  const gross = savedPerimeterMeters(scan) * savedCeilingHeightMeters(scan);
  const net = Math.max(0, gross - openingAreaSquareMeters(scan.geometry));
  return { gross, net };
}

export type PlanSegment = { x1: number; y1: number; x2: number; y2: number };
export type PlanOpening = PlanSegment & {
  kind: "door" | "window" | "opening";
  /** See `ScanGeometry.editedOpenings` — absent on scanned openings. */
  hinge?: "start" | "end";
  opens?: "in" | "out";
};
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
 * Set a wall the scan read a few degrees out of square exactly square.
 *
 * RoomPlan measures each wall on its own, so the walls of a square room come
 * back a degree or three off one another and the plan reads crooked — the
 * owner's complaint of 19 Oct 2026. After `squareToPage` has turned the room
 * to the page, a wall within 5° of the page's axes is turned, about its own
 * middle, onto the axis it is already nearest. A wall further off than that
 * is a real angle — a bay, a 45° corner — and is left exactly as scanned.
 *
 * This is NOT the regularisation reverted in August, which collapsed
 * perpendicular walls into parallel ones: a wall here can only turn onto the
 * axis it is within 5° of, so a perpendicular stays perpendicular, and no
 * wall moves more than 5° or changes length.
 *
 * An opening turns with the wall it is cut into, about that wall's middle,
 * so a door stays in its wall; an opening on no wall is squared on its own.
 * Twin: `FloorPlanGeometry.squareNearlySquare` on the phone.
 */
const SQUARE_SNAP = (5 * Math.PI) / 180;
const HOST_OFFSET = 0.15;

function squareNearlySquare(walls: PlanSegment[], openings: PlanOpening[]): {
  walls: PlanSegment[];
  openings: PlanOpening[];
} {
  /** The turn that puts a segment on its nearest axis, or 0 when it is off
      by more than the snap (or already on it). */
  const turnOf = (seg: PlanSegment) => {
    let angle = Math.atan2(seg.y2 - seg.y1, seg.x2 - seg.x1);
    while (angle > Math.PI / 4) angle -= Math.PI / 2;
    while (angle <= -Math.PI / 4) angle += Math.PI / 2;
    return Math.abs(angle) <= SQUARE_SNAP ? -angle : 0;
  };
  const turned = <T extends PlanSegment>(seg: T, by: number, cx: number, cy: number): T => {
    if (by === 0) return seg;
    const cos = Math.cos(by);
    const sin = Math.sin(by);
    const at = (x: number, y: number) => ({
      x: cx + (x - cx) * cos - (y - cy) * sin,
      y: cy + (x - cx) * sin + (y - cy) * cos,
    });
    const a = at(seg.x1, seg.y1);
    const b = at(seg.x2, seg.y2);
    return { ...seg, x1: a.x, y1: a.y, x2: b.x, y2: b.y };
  };
  const mid = (seg: PlanSegment) => ({ x: (seg.x1 + seg.x2) / 2, y: (seg.y1 + seg.y2) / 2 });

  const turns = walls.map(turnOf);
  const squaredWalls = walls.map((w, i) => {
    const c = mid(w);
    return turned(w, turns[i], c.x, c.y);
  });

  const squaredOpenings = openings.map((o) => {
    // The wall it sits in: near-parallel, within a wall's thickness of its
    // line, and overlapping it along its length.
    const oc = mid(o);
    let host = -1;
    let bestOffset = HOST_OFFSET;
    walls.forEach((w, i) => {
      const len = Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
      if (len === 0) return;
      const ux = (w.x2 - w.x1) / len;
      const uy = (w.y2 - w.y1) / len;
      const olen = Math.hypot(o.x2 - o.x1, o.y2 - o.y1) || 1;
      const parallel = Math.abs(((o.x2 - o.x1) * ux + (o.y2 - o.y1) * uy) / olen);
      if (parallel < Math.cos((10 * Math.PI) / 180)) return;
      const offset = Math.abs((oc.x - w.x1) * uy - (oc.y - w.y1) * ux);
      const along = (oc.x - w.x1) * ux + (oc.y - w.y1) * uy;
      if (offset > bestOffset || along < -HOST_OFFSET || along > len + HOST_OFFSET) return;
      host = i;
      bestOffset = offset;
    });
    if (host >= 0) {
      const c = mid(walls[host]);
      return turned(o, turns[host], c.x, c.y);
    }
    return turned(o, turnOf(o), oc.x, oc.y);
  });

  return { walls: squaredWalls, openings: squaredOpenings };
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

/**
 * The same line, described with a direction within a quarter turn of
 * `ref`'s. `lineOf` folds a direction onto [0, pi), so the two pieces of one
 * level wall can come back as 0 and as pi minus a hair — the same line, but
 * with offsets of OPPOSITE sign, since the offset is measured along the
 * folded direction's normal. Compared as they were, they never grouped. Rare
 * on raw scans, constant once `squareNearlySquare` sets walls exactly level
 * (found by the phone/web parity run, 19 Oct 2026).
 */
function inFrameOf(ref: Line, line: Line): Line {
  const d = line.angle - ref.angle;
  if (d > Math.PI / 2) return { angle: line.angle - Math.PI, offset: -line.offset };
  if (d < -Math.PI / 2) return { angle: line.angle + Math.PI, offset: -line.offset };
  return line;
}

function alignCollinearWalls(walls: PlanSegment[], openings: PlanOpening[]): {
  walls: PlanSegment[];
  openings: PlanOpening[];
} {
  if (walls.length < 2) return { walls, openings };

  const lines = walls.map(lineOf);
  const lengths = walls.map((s) => Math.hypot(s.x2 - s.x1, s.y2 - s.y1));

  // Group walls that describe the same line, each compared in the frame of
  // the group's first wall (see inFrameOf).
  const groupOf = new Array<number>(walls.length).fill(-1);
  const groups: number[][] = [];
  for (let i = 0; i < walls.length; i += 1) {
    if (groupOf[i] >= 0) continue;
    const group = [i];
    groupOf[i] = groups.length;
    for (let j = i + 1; j < walls.length; j += 1) {
      if (groupOf[j] >= 0) continue;
      const other = inFrameOf(lines[i], lines[j]);
      if (Math.abs(other.angle - lines[i].angle) > COLLINEAR_ANGLE) continue;
      if (Math.abs(other.offset - lines[i].offset) > COLLINEAR_OFFSET) continue;
      group.push(j);
      groupOf[j] = groups.length;
    }
    groups.push(group);
  }

  // The line each group agrees on, in its first wall's frame: longer walls
  // were measured over more surface and are trusted proportionally more.
  const target: Line[] = new Array<Line>(walls.length);
  for (const group of groups) {
    const ref = lines[group[0]];
    const total = group.reduce((sum, i) => sum + lengths[i], 0) || 1;
    const framed = group.map((i) => inFrameOf(ref, lines[i]));
    const offset = framed.reduce((sum, l, k) => sum + l.offset * lengths[group[k]], 0) / total;
    const angle = framed.reduce((sum, l, k) => sum + l.angle * lengths[group[k]], 0) / total;
    for (const i of group) target[i] = { angle, offset };
  }

  /** Slide a segment along its own normal by `shift`. */
  const slide = <T extends PlanSegment>(s: T, angle: number, shift: number): T => {
    const nx = Math.sin(angle);
    const ny = -Math.cos(angle);
    return { ...s, x1: s.x1 + nx * shift, y1: s.y1 + ny * shift, x2: s.x2 + nx * shift, y2: s.y2 + ny * shift };
  };

  const movedWalls = walls.map((s, i) =>
    slide(s, lines[i].angle, inFrameOf(lines[i], target[i]).offset - lines[i].offset),
  );

  // Openings follow the wall they were cut from — the nearest line among
  // the groups, on the same test. An opening with no wall near enough is
  // left where the scan put it rather than dragged somewhere invented.
  const movedOpenings = openings.map((o) => {
    const line = lineOf(o);
    let best = -1;
    let bestDistance = COLLINEAR_OFFSET;
    for (let i = 0; i < walls.length; i += 1) {
      const wall = inFrameOf(line, target[i]);
      if (Math.abs(wall.angle - line.angle) > COLLINEAR_ANGLE) continue;
      const distance = Math.abs(line.offset - wall.offset);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = i;
      }
    }
    return best < 0 ? o : slide(o, line.angle, inFrameOf(line, target[best]).offset - line.offset);
  });

  return { walls: movedWalls, openings: movedOpenings };
}

/**
 * Chain wall segments into a closed outline.
 *
 * The walk lives in `wallChain.ts` now, behind a cleaning pass, because the
 * old one gave up on real RoomPlan output — walls in pieces, walls seen
 * twice, doorway stubs — and something downstream then drew a bounding box,
 * silently turning a room with a nook into a rectangle.
 *
 * Still returns an empty array rather than a wrong shape when the walls
 * genuinely do not close. What changed is how rarely that now happens, and
 * that a guessed closing edge is reported instead of assumed.
 */
function chainIntoPolygon(segments: PlanSegment[]): PlanPoint[] {
  // 0,25 m, the phone's own tolerance (`FloorPlanGeometry.chainIntoPolygon`).
  // This side used the module default, 0,30, so the two could disagree on
  // whether a room closed at all.
  const outline = chainOutline(segments, { weld: 0.25 });
  if (!outline || outline.inferredClosingEdge) return [];
  // Repeat the first corner at the end. `chainOutline` returns bare corners,
  // which is the better primitive, but everything downstream of here has
  // always been handed a closed ring — a fill needs one, and `planCorners`
  // exists to strip it back off. Changing that contract here would be a
  // silent behaviour change in every consumer at once.
  return [...outline.points, outline.points[0]];
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
export function toFloorPlan(result: ScanGeometry): FloorPlan {
  // A plan the operator corrected by hand replaces the scan's walls for
  // drawing purposes — but only for drawing; the sensor's own geometry is
  // still in the record underneath, untouched. This mirrors
  // `FloorPlanGeometry.plan(from:)` on the phone, and has to keep mirroring
  // it: the same blob is drawn by both halves of the app, and a plan that
  // differs between the phone and the web is a plan nobody can trust.
  const edited = result.editedPolygon;
  if (edited && edited.length >= 3) {
    const xs = edited.map((p) => p.x);
    const ys = edited.map((p) => p.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const points = edited.map((p) => ({ x: p.x - minX, y: p.y - minY }));
    return {
      segments: points.map((a, i) => {
        const b = points[(i + 1) % points.length];
        return { x1: a.x, y1: a.y, x2: b.x, y2: b.y };
      }),
      // The editor corrects the outline only. The detected doors and windows
      // are positioned in the scan's own frame and would land in the wrong
      // walls on a corrected outline, so — like the native renderer — they
      // are not drawn. They still deduct from net wall area.
      //
      // Unless the caller traced the openings itself, in the outline's own
      // frame (`editedOpenings`) — see that field's comment. Shifted by the
      // same minX/minY as the outline, so a door stays on the wall it was
      // traced against.
      openings: (result.editedOpenings ?? []).map((o) => ({
        x1: o.x1 - minX,
        y1: o.y1 - minY,
        x2: o.x2 - minX,
        y2: o.y2 - minY,
        kind: o.kind,
        hinge: o.hinge,
        opens: o.opens,
      })),
      polygon: points,
      width: Math.max(...xs) - minX,
      height: Math.max(...ys) - minY,
      offsetX: minX,
      offsetY: minY,
    };
  }

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
  const squared = squareNearlySquare(
    rotated.slice(0, rawWalls.length),
    rotated.slice(rawWalls.length) as PlanOpening[],
  );
  const aligned = alignCollinearWalls(squared.walls, squared.openings);
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

  const chained: FloorPlan = {
    segments,
    openings: rawOpenings.map(shift),
    polygon: chainIntoPolygon(segments),
    width: Math.max(...xs) - minX,
    height: Math.max(...ys) - minY,
    offsetX: minX,
    offsetY: minY,
  };

  // The floor's own boundary, traced from the mesh independent of RoomPlan's
  // wall list. Mirrors `FloorPlanGeometry.plan(from:)` on the phone — the
  // two gates must agree, or a report generated on the web disagrees with
  // the number the operator saw on the phone that measured it.
  //
  // Trusted only when it does not disagree sharply with the wall-chained
  // area (30%: looser than a single wall's own 15% refinement tolerance,
  // because the whole point of tracing the floor separately is that it is
  // SOMETIMES right where the wall chain is wrong) OR when the wall chain
  // never closed at all, in which case there is nothing to disagree with.
  const traced = result.meshFloorPolygon;
  if (traced && traced.length >= 3) {
    const tracedArea = polygonAreaSquareMeters(traced);
    const chainClosed = chained.polygon.length >= 4;
    const chainedArea = chainClosed ? polygonAreaSquareMeters(chained.polygon.slice(0, -1)) : 0;
    const agrees =
      chainClosed && chainedArea > 0.5 && Math.abs(tracedArea - chainedArea) / Math.max(chainedArea, 0.01) < 0.3;
    if (tracedArea > 0.5 && (!chainClosed || chainedArea <= 0.5 || agrees)) {
      const txs = traced.map((p) => p.x);
      const tys = traced.map((p) => p.y);
      const tMinX = Math.min(...txs);
      const tMinY = Math.min(...tys);
      const points = traced.map((p) => ({ x: p.x - tMinX, y: p.y - tMinY }));
      return {
        segments: points.map((a, i) => {
          const b = points[(i + 1) % points.length];
          return { x1: a.x, y1: a.y, x2: b.x, y2: b.y };
        }),
        // No openings: `chained`'s own openings are in ITS rotated,
        // normalised frame (`squareToPage` ran before that plan was shifted
        // to its origin) while this traced polygon is still in raw,
        // unrotated world metres — the same reason the edited-polygon
        // branch above draws none either. They still deduct from net wall
        // area regardless; only the drawing is affected.
        openings: [],
        polygon: [...points, points[0]],
        width: Math.max(...txs) - tMinX,
        height: Math.max(...tys) - tMinY,
        offsetX: tMinX,
        offsetY: tMinY,
      };
    }
  }

  return chained;
}

/**
 * The room's corners — the array a wall index counts against.
 *
 * `plan.polygon` may or may not repeat its first point at the end: the
 * chained-from-walls outline closes itself, while a hand-corrected one is
 * already a bare corner list. The phone reconstructs its corners by dropping
 * the last point unconditionally (`PlanEditorView.swift`), which is why
 * `FloorPlanGeometry` appends a closing point in both cases. Here the test is
 * on the points themselves, so it is right either way round rather than
 * depending on which branch of `toFloorPlan` produced the outline — reading
 * an unclosed outline as a closed one silently deletes a real corner, and
 * with it renumbers every wall after it.
 */
export function planCorners(plan: Pick<FloorPlan, "polygon">): PlanPoint[] {
  const points = plan.polygon;
  if (points.length < 2) return [...points];
  const first = points[0];
  const last = points[points.length - 1];
  const closed = Math.hypot(last.x - first.x, last.y - first.y) < 1e-6;
  return closed ? points.slice(0, -1) : [...points];
}

/** RoomPlan measures in meters; every price book unit here is imperial. */
export function metersToFeet(meters: number): number {
  return meters * 3.28084;
}

export function squareMetersToSquareFeet(squareMeters: number): number {
  return squareMeters * 10.7639;
}
