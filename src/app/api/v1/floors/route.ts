import { NextResponse } from "next/server";
import { guarded } from "../guard";
import { setFloorDisplayAngle, setFloorWallWidths, validWallWidth } from "@/lib/crm/floorDisplay";

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

  // Wall widths (0058): either or both, metres. A body carrying them is a
  // thickness change, never a turn.
  if ("interiorWallM" in body || "exteriorWallM" in body) {
    const widths: { interiorM?: number; exteriorM?: number } = {};
    if ("interiorWallM" in body) {
      const v = Number(body.interiorWallM);
      if (!validWallWidth("interiorM", v)) {
        return NextResponse.json({ error: "interiorWallM must be between 0.03 and 0.6 m." }, { status: 400 });
      }
      widths.interiorM = v;
    }
    if ("exteriorWallM" in body) {
      const v = Number(body.exteriorWallM);
      if (!validWallWidth("exteriorM", v)) {
        return NextResponse.json({ error: "exteriorWallM must be between 0.03 and 0.8 m." }, { status: 400 });
      }
      widths.exteriorM = v;
    }
    return guarded(async () => {
      await setFloorWallWidths(projectId, level, widths);
      return { ok: true };
    });
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
