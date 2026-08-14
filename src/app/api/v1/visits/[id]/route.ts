import { NextResponse } from "next/server";
import { guarded } from "../../guard";
import { updateVisit } from "@/lib/crm/jobs";

/** Tick a visit off, or untick it — the one schedule action that happens
    in a driveway rather than at a desk. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  return guarded(async () => {
    await updateVisit(id, {
      ...(typeof body.completed === "boolean" ? { completed: body.completed } : {}),
    });
    return { ok: true };
  });
}
