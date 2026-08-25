import { NextResponse } from "next/server";
import { guarded } from "../guard";
import { setFloorDisplayAngle } from "@/lib/crm/floorDisplay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** How a storey is turned on screen — a display fact, not a measurement.
    See migration 0043 for why this is its own tiny table rather than
    another rewrite of every room's saved plan. */
export async function PATCH(request: Request) {
  const params = new URL(request.url).searchParams;
  const projectId = params.get("projectId");
  const level = params.get("level");
  if (!projectId || !level) {
    return NextResponse.json({ error: "projectId and level are both required." }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const angle = Number(body.displayAngle);
  if (!Number.isFinite(angle)) {
    return NextResponse.json({ error: "displayAngle must be a number." }, { status: 400 });
  }

  return guarded(async () => {
    await setFloorDisplayAngle(projectId, level, angle);
    return { ok: true };
  });
}
