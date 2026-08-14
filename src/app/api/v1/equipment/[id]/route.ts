import { NextResponse } from "next/server";
import { guarded } from "../../guard";
import { deleteEquipment, updateEquipment } from "@/lib/crm/dryingLog";

/** Chiefly used to stop the clock: setting out_of_service_at is what ends
    the billable window for a unit. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  return guarded(async () => {
    await updateEquipment(id, {
      ...(typeof body.outOfServiceAt === "string" || body.outOfServiceAt === null
        ? { outOfServiceAt: body.outOfServiceAt as string | null }
        : {}),
      ...(Number.isFinite(Number(body.quantity)) && body.quantity !== undefined
        ? { quantity: Number(body.quantity) }
        : {}),
      ...(typeof body.notes === "string" || body.notes === null
        ? { notes: body.notes as string | null }
        : {}),
    });
    return { ok: true };
  });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return guarded(async () => {
    await deleteEquipment(id);
    return { ok: true };
  });
}
