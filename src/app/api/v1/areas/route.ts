import { NextResponse } from "next/server";
import { guarded } from "../guard";
import {
  createAffectedArea,
  listAffectedAreas,
  listProjectAffectedAreas,
  DAMAGE_TYPES,
  type AreaPoint,
  type DamageType,
} from "@/lib/crm/affectedAreas";

/**
 * Affected areas, by room scan or across a whole project.
 *
 * `?roomScanId=` for one room's areas while editing it; `?projectId=` for
 * every area on the property, which is what a report and a whole-job total
 * are built from.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const roomScanId = params.get("roomScanId");
  const projectId = params.get("projectId");

  if (roomScanId) {
    return guarded(async () => ({ areas: await listAffectedAreas(roomScanId) }));
  }
  if (projectId) {
    return guarded(async () => ({ areas: await listProjectAffectedAreas(projectId) }));
  }
  return NextResponse.json(
    { error: "Pass either roomScanId or projectId." },
    { status: 400 },
  );
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const roomScanId = typeof body.roomScanId === "string" ? body.roomScanId : "";
  if (!roomScanId) {
    return NextResponse.json({ error: "roomScanId is required." }, { status: 400 });
  }

  // A shape needs three corners to enclose anything. Refusing here rather
  // than storing a degenerate polygon means an area always has a real
  // measurement behind it.
  const polygon = Array.isArray(body.polygon)
    ? (body.polygon as unknown[]).flatMap((p) => {
        const point = p as { x?: unknown; y?: unknown };
        const x = Number(point?.x);
        const y = Number(point?.y);
        return Number.isFinite(x) && Number.isFinite(y) ? [{ x, y } as AreaPoint] : [];
      })
    : [];
  if (polygon.length < 3) {
    return NextResponse.json(
      { error: "An affected area needs at least three corners." },
      { status: 400 },
    );
  }

  const surface = body.surface === "wall" ? "wall" : "floor";
  const damageType = DAMAGE_TYPES.includes(body.damageType as DamageType)
    ? (body.damageType as DamageType)
    : "water";

  return guarded(async () => ({
    id: await createAffectedArea({
      roomScanId,
      surface,
      wallIndex:
        surface === "wall" && Number.isFinite(Number(body.wallIndex))
          ? Number(body.wallIndex)
          : surface === "wall"
            ? 0
            : null,
      name: typeof body.name === "string" ? body.name : undefined,
      damageType,
      color: typeof body.color === "string" ? body.color : null,
      polygon,
      notes: typeof body.notes === "string" ? body.notes : null,
    }),
  }));
}
