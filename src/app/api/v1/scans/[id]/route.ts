import { NextResponse } from "next/server";
import { guarded } from "../../guard";
import { deleteRoomScan, saveEditedPolygon, updateRoomScan } from "@/lib/crm/roomScans";

/** Rename a room or move it to another floor. The measurements themselves
    are a record of what was scanned and are deliberately not editable. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  return guarded(async () => {
    // A corrected outline, from the plan editor. Handled before the field
    // updates because it is a different kind of change: the others rename
    // and file a room, this one restates its measurements.
    if (Array.isArray(body.editedPolygon)) {
      const polygon = (body.editedPolygon as unknown[]).flatMap((p) => {
        const point = p as { x?: unknown; y?: unknown };
        const x = Number(point?.x);
        const y = Number(point?.y);
        return Number.isFinite(x) && Number.isFinite(y) ? [{ x, y }] : [];
      });
      if (polygon.length < 3) {
        throw new Error("A room needs at least three corners.");
      }
      const locked = Array.isArray(body.lockedEdges)
        ? (body.lockedEdges as unknown[])
            .map((n) => Number(n))
            .filter((n) => Number.isInteger(n) && n >= 0 && n < polygon.length)
        : [];
      await saveEditedPolygon(id, polygon, locked);
    }

    await updateRoomScan(id, {
      ...(typeof body.name === "string" ? { name: body.name } : {}),
      ...(typeof body.level === "string" ? { level: body.level } : {}),
      ...(Number.isFinite(Number(body.position)) && body.position !== undefined
        ? { position: Number(body.position) }
        : {}),
      ...(typeof body.notes === "string" || body.notes === null ? { notes: body.notes } : {}),
      // Placing a room is a drag, so these arrive together and often. null
      // is meaningful — it puts the room back into the packed layout.
      ...(body.planX === null || Number.isFinite(Number(body.planX))
        ? { planX: body.planX === null ? null : Number(body.planX) }
        : {}),
      ...(body.planY === null || Number.isFinite(Number(body.planY))
        ? { planY: body.planY === null ? null : Number(body.planY) }
        : {}),
    });
    return { ok: true };
  });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return guarded(async () => {
    await deleteRoomScan(id);
    return { ok: true };
  });
}
