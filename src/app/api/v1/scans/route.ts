import { NextResponse } from "next/server";
import { guarded } from "../guard";
import { createRoomScan, listRoomScans } from "@/lib/crm/roomScans";
import { MEASURE_DEFINITIONS } from "@/lib/crm/measureDefinitions";
import { getFloorDisplayAngles, getFloorWallWidths } from "@/lib/crm/floorDisplay";

/** Every scan on a project. `?projectId=` is required — a scan only means
    something in the context of the property it measured.

    The definitions travel with the figures, the way the living-area response
    already ships its own: a number an API hands out without saying what it
    measures is a number the client will caption wrong. */
export async function GET(request: Request) {
  const projectId = new URL(request.url).searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "projectId is required." }, { status: 400 });
  }
  return guarded(async () => ({
    scans: await listRoomScans(projectId),
    definitions: MEASURE_DEFINITIONS,
    // How each floor is turned on screen — bundled here rather than a
    // second round trip, since reading the plan and reading how it is
    // drawn happen together every time. See migration 0043.
    floorDisplay: await getFloorDisplayAngles(projectId),
    // Each floor's stated wall widths (0058). Only stated floors appear.
    floorWalls: await getFloorWallWidths(projectId),
  }));
}

/** Save a finished scan. The phone posts the measurements it took; the
    server does not recompute them, because it cannot — it was not there. */
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const projectId = typeof body.projectId === "string" ? body.projectId : "";
  if (!projectId) {
    return NextResponse.json({ error: "projectId is required." }, { status: 400 });
  }

  const num = (value: unknown): number => {
    const n = Number(value);
    // A NaN here would be stored and then rendered as a measurement, which is
    // worse than a zero: it looks like a reading rather than a missing one.
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };

  return guarded(async () => ({
    id: await createRoomScan({
      projectId,
      name: typeof body.name === "string" ? body.name : "Room",
      level: typeof body.level === "string" ? body.level : "Ground",
      position: Number.isFinite(Number(body.position)) ? Number(body.position) : 0,
      floorAreaSqm: num(body.floorAreaSqm),
      wallLengthM: num(body.wallLengthM),
      ceilingHeightM: num(body.ceilingHeightM),
      doorCount: Math.round(num(body.doorCount)),
      windowCount: Math.round(num(body.windowCount)),
      stairCount: Math.round(num(body.stairCount)),
      geometry:
        body.geometry && typeof body.geometry === "object"
          ? (body.geometry as Record<string, unknown>)
          : {},
      notes: typeof body.notes === "string" ? body.notes : null,
      // Asked at capture, so it arrives with the scan — including a scan
      // that sat in the offline queue. Absent means unclassified, which the
      // living-area engine treats as `other`; it must never be invented here.
      roomType: typeof body.roomType === "string" ? body.roomType : null,
      rawCapture: parseRawCapture(body.rawCapture),
    }),
  }));
}

/**
 * RoomPlan's CapturedRoom, sent by the phone as JSON TEXT (it rides the
 * offline queue as a string, so it is stored on disk exactly as Apple encoded
 * it). Parsed here so Postgres holds it as jsonb and it can be queried later.
 * Anything that will not parse is dropped, not stored as a broken string — an
 * archive that cannot be read back is not an archive.
 */
function parseRawCapture(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "string" || value.length === 0) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
