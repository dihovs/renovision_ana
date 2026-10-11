import { alignLooseEdges, assemble, estimateScale, snapPolygon, type ImportedRoom, type Point } from "./geometry";
import { preparePlan } from "./raster";
import { PlanReadError, readPlan } from "./extract";

export { PlanReadError };
export type { ImportedRoom };

export type PlanImport = {
  rooms: ImportedRoom[];
  /** Pixels per metre on the prepared image, and where that figure came from. */
  scale: number;
  scaleFrom: "printed sizes" | "door widths";
  /** What the reader was unsure of, plus anything the geometry noticed. */
  notes: string[];
};

/** A standard interior door, for a plan with no dimensions printed at all. */
const DOOR_M = 0.813;

/** Straighten sides the model gave a few pixels off level or plumb. */
function square(polygon: Point[]): Point[] {
  const out = polygon.map((p) => ({ ...p }));
  for (let i = 0; i < out.length; i++) {
    const p = out[i];
    const q = out[(i + 1) % out.length];
    const dx = Math.abs(q.x - p.x);
    const dy = Math.abs(q.y - p.y);
    if (dy < dx * 0.1) p.y = q.y = (p.y + q.y) / 2;
    else if (dx < dy * 0.1) p.x = q.x = (p.x + q.x) / 2;
  }
  return out;
}

/**
 * A picture of somebody else's floor plan → rooms ready to file on a floor.
 * Writes nothing: the phone shows the result and files the rooms itself, the
 * same way it files a room drawn by hand, so an imported room is an ordinary
 * room everywhere downstream.
 */
export async function importPlan(input: Buffer): Promise<PlanImport> {
  const plan = await preparePlan(input);
  const { width, height } = plan.mask;
  const read = await readPlan(plan.image, plan.mediaType, width, height);
  if (read.rooms.length === 0) throw new PlanReadError("No rooms could be found on that image.");

  const reach = Math.round(Math.max(width, height) * 0.025);
  let unsnapped = 0;
  const snapped = read.rooms.map((room) => {
    const result = snapPolygon(plan.mask, square(room.polygon), reach);
    if (result.snapped < room.polygon.length / 2) unsnapped++;
    return { ...room, polygon: result.polygon, edgeSnapped: result.edgeSnapped };
  });
  const lined = alignLooseEdges(snapped, reach, Math.max(width, height) * 0.25);
  const rooms = snapped.map((room, i) => ({ ...room, polygon: lined[i] }));

  const notes: string[] = [];
  if (read.notes.trim()) notes.push(read.notes.trim());

  let scale = estimateScale(rooms);
  let scaleFrom: PlanImport["scaleFrom"] = "printed sizes";
  if (!scale) {
    const doors = read.openings
      .filter((o) => o.kind === "doorSingle")
      .map((o) => Math.hypot(o.b.x - o.a.x, o.b.y - o.a.y))
      .filter((l) => l > 5)
      .sort((a, b) => a - b);
    if (!doors.length) {
      throw new PlanReadError("The plan has no printed sizes or doors to work out its scale from.");
    }
    scale = doors[Math.floor(doors.length / 2)] / DOOR_M;
    scaleFrom = "door widths";
    notes.push("No room sizes were printed, so the scale comes from the doors (taken as 32 in). Check one wall with a tape.");
  }
  if (unsnapped) {
    notes.push(`${unsnapped} room${unsnapped === 1 ? "" : "s"} could not be lined up with the drawn walls and may be a few inches out.`);
  }

  return { rooms: assemble(rooms, read.openings, scale), scale, scaleFrom, notes };
}
