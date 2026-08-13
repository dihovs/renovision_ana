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

export type RoomScanResult = {
  walls: RoomScanWall[];
  floors: RoomScanFloor[];
  doorCount: number;
  windowCount: number;
  openingCount: number;
  stairCount: number;
};

type RoomScanBridge = {
  isSupported(): Promise<{ supported: boolean }>;
  startScan(): Promise<RoomScanResult>;
};

const RoomScan = registerPlugin<RoomScanBridge>("RoomScan");

export async function isRoomScanSupported(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    return (await RoomScan.isSupported()).supported;
  } catch {
    return false;
  }
}

/** Throws on cancel or an unsupported device — the caller's catch block IS
    the "no scan happened" path, not a separate flag to check first. */
export async function scanRoom(): Promise<RoomScanResult> {
  return RoomScan.startScan();
}

/** Perimeter, not floor area — what a baseboard or a chair rail is priced
    against, and RoomPlan hands back individual wall segments, not a sum. */
export function totalWallLengthMeters(result: RoomScanResult): number {
  return result.walls.reduce((sum, wall) => sum + wall.lengthMeters, 0);
}

export function totalFloorAreaSquareMeters(result: RoomScanResult): number {
  return result.floors.reduce((sum, floor) => sum + floor.areaSquareMeters, 0);
}

export type PlanSegment = { x1: number; y1: number; x2: number; y2: number };
export type FloorPlan = {
  segments: PlanSegment[];
  /** Bounding box in metres, for fitting the plan to whatever it's drawn in. */
  width: number;
  height: number;
};

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
  const raw = result.walls.map((wall) => {
    const half = wall.lengthMeters / 2;
    return {
      x1: wall.centerX - wall.axisX * half,
      y1: wall.centerZ - wall.axisZ * half,
      x2: wall.centerX + wall.axisX * half,
      y2: wall.centerZ + wall.axisZ * half,
    };
  });

  if (raw.length === 0) return { segments: [], width: 0, height: 0 };

  const xs = raw.flatMap((s) => [s.x1, s.x2]);
  const ys = raw.flatMap((s) => [s.y1, s.y2]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);

  return {
    segments: raw.map((s) => ({
      x1: s.x1 - minX,
      y1: s.y1 - minY,
      x2: s.x2 - minX,
      y2: s.y2 - minY,
    })),
    width: Math.max(...xs) - minX,
    height: Math.max(...ys) - minY,
  };
}

/** RoomPlan measures in meters; every price book unit here is imperial. */
export function metersToFeet(meters: number): number {
  return meters * 3.28084;
}

export function squareMetersToSquareFeet(squareMeters: number): number {
  return squareMeters * 10.7639;
}
