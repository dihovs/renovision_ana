import { NextResponse } from "next/server";
import { guarded } from "../guard";
import { createRoomScan, listRoomScans } from "@/lib/crm/roomScans";
import { MEASURE_DEFINITIONS } from "@/lib/crm/measureDefinitions";

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
    }),
  }));
}
