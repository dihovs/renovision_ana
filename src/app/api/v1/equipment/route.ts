import { NextResponse } from "next/server";
import { guarded } from "../guard";
import { createEquipment, listEquipment } from "@/lib/crm/dryingLog";

export async function GET(request: Request) {
  const projectId = new URL(request.url).searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "projectId is required." }, { status: 400 });
  }
  return guarded(async () => ({ equipment: await listEquipment(projectId) }));
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const projectId = typeof body.projectId === "string" ? body.projectId : "";
  const kind = typeof body.kind === "string" ? body.kind.trim() : "";
  if (!projectId) {
    return NextResponse.json({ error: "projectId is required." }, { status: 400 });
  }
  // Without a kind the row bills for an unnamed machine, which is the line an
  // adjuster queries first.
  if (!kind) {
    return NextResponse.json({ error: "Say what the equipment is." }, { status: 400 });
  }

  return guarded(async () => ({
    id: await createEquipment({
      projectId,
      kind,
      roomScanId: typeof body.roomScanId === "string" ? body.roomScanId : null,
      identifier: typeof body.identifier === "string" ? body.identifier : null,
      quantity: Number.isFinite(Number(body.quantity)) ? Number(body.quantity) : 1,
      inServiceAt: typeof body.inServiceAt === "string" ? body.inServiceAt : undefined,
      outOfServiceAt: typeof body.outOfServiceAt === "string" ? body.outOfServiceAt : null,
      notes: typeof body.notes === "string" ? body.notes : null,
    }),
  }));
}
