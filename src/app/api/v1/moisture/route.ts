import { NextResponse } from "next/server";
import { guarded } from "../guard";
import {
  createMoistureReading,
  listMoistureReadings,
  listProjectMoistureReadings,
} from "@/lib/crm/dryingLog";

/** `?roomScanId=` while logging a room; `?projectId=` for the drying log
    page of the report. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const roomScanId = params.get("roomScanId");
  const projectId = params.get("projectId");

  if (roomScanId) {
    return guarded(async () => ({ readings: await listMoistureReadings(roomScanId) }));
  }
  if (projectId) {
    return guarded(async () => ({ readings: await listProjectMoistureReadings(projectId) }));
  }
  return NextResponse.json({ error: "Pass either roomScanId or projectId." }, { status: 400 });
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const roomScanId = typeof body.roomScanId === "string" ? body.roomScanId : "";
  if (!roomScanId) {
    return NextResponse.json({ error: "roomScanId is required." }, { status: 400 });
  }

  /**
   * Absent stays absent. A missing instrument reading must arrive as null,
   * not zero — "0% moisture" is a reading nobody took, and it would sit in a
   * claim file looking like one somebody did.
   */
  const measured = (value: unknown): number | null => {
    if (value === null || value === undefined || value === "") return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };

  const reading = {
    materialPercent: measured(body.materialPercent),
    relativeHumidity: measured(body.relativeHumidity),
    temperatureC: measured(body.temperatureC),
    gpp: measured(body.gpp),
  };

  // A row with no numbers in it is not a reading; it is an empty form that
  // would show up on the drying curve as a gap somebody has to explain.
  if (Object.values(reading).every((v) => v === null)) {
    return NextResponse.json(
      { error: "Record at least one measurement." },
      { status: 400 },
    );
  }

  return guarded(async () => ({
    id: await createMoistureReading({
      roomScanId,
      takenAt: typeof body.takenAt === "string" ? body.takenAt : undefined,
      location: typeof body.location === "string" ? body.location : "",
      material: typeof body.material === "string" ? body.material : null,
      notes: typeof body.notes === "string" ? body.notes : null,
      ...reading,
    }),
  }));
}
