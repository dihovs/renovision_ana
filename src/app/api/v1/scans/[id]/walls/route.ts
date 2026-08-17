import { NextResponse } from "next/server";
import { guarded } from "../../../guard";
import { listRoomWalls, upsertRoomWall } from "@/lib/crm/roomWalls";

/** Every wall of this room that has a detail set on it. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return guarded(async () => ({ walls: await listRoomWalls(id) }));
}

/** Set one wall's Load-Bearing flag, Display Elevation in Report flag, or
    notes. `wallIndex` says which — a wall has no id of its own. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const wallIndex = Number(body.wallIndex);
  if (!Number.isInteger(wallIndex) || wallIndex < 0) {
    return NextResponse.json({ error: "wallIndex is required." }, { status: 400 });
  }

  return guarded(async () => {
    await upsertRoomWall(id, wallIndex, {
      ...(typeof body.loadBearing === "boolean" ? { loadBearing: body.loadBearing } : {}),
      ...(typeof body.displayElevation === "boolean"
        ? { displayElevation: body.displayElevation }
        : {}),
      ...(typeof body.notes === "string" || body.notes === null ? { notes: body.notes as string | null } : {}),
    });
    return { ok: true };
  });
}
