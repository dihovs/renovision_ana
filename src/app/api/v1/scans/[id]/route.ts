import { NextResponse } from "next/server";
import { guarded } from "../../guard";
import { deleteRoomScan, updateRoomScan } from "@/lib/crm/roomScans";

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
    await updateRoomScan(id, {
      ...(typeof body.name === "string" ? { name: body.name } : {}),
      ...(typeof body.level === "string" ? { level: body.level } : {}),
      ...(Number.isFinite(Number(body.position)) && body.position !== undefined
        ? { position: Number(body.position) }
        : {}),
      ...(typeof body.notes === "string" || body.notes === null ? { notes: body.notes } : {}),
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
