import { NextResponse } from "next/server";
import { guarded } from "../../guard";
import {
  deleteAffectedArea,
  updateAffectedArea,
  DAMAGE_TYPES,
  type AreaPoint,
  type DamageType,
} from "@/lib/crm/affectedAreas";

/** Rename, recolour, reclassify, reshape, or toggle dimension display on one area. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const patch: Parameters<typeof updateAffectedArea>[1] = {};

  if (typeof body.name === "string") patch.name = body.name;
  if (typeof body.notes === "string") patch.notes = body.notes;
  if (body.color === null || typeof body.color === "string") {
    patch.color = body.color as string | null;
  }
  if (DAMAGE_TYPES.includes(body.damageType as DamageType)) {
    patch.damageType = body.damageType as DamageType;
  }
  if (typeof body.showDimensions === "boolean") patch.showDimensions = body.showDimensions;

  if (body.polygon !== undefined) {
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
    patch.polygon = polygon;
  }

  return guarded(async () => {
    await updateAffectedArea(id, patch);
    return { ok: true };
  });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return guarded(async () => {
    await deleteAffectedArea(id);
    return { ok: true };
  });
}
