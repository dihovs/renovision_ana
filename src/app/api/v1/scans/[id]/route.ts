import { NextResponse } from "next/server";
import { guarded } from "../../guard";
import { deleteRoomScan, saveEditedPolygon, updateRoomScan } from "@/lib/crm/roomScans";
import type { AuthoredOpenings, OpeningSurface } from "@/lib/crm/roomScans";

/** One synthesized opening surface, or nothing — a single bad number drops
    the record rather than storing a NaN that will later render as a door. */
function readSurface(value: unknown): OpeningSurface | null {
  const record = value as Record<string, unknown>;
  const fields = [
    "lengthMeters",
    "widthMeters",
    "heightMeters",
    "centerX",
    "centerZ",
    "axisX",
    "axisZ",
  ] as const;
  const out = {} as Record<(typeof fields)[number], number>;
  for (const field of fields) {
    const n = Number(record?.[field]);
    if (!Number.isFinite(n)) return null;
    out[field] = n;
  }
  return out;
}

/** The openings half of an edited-plan save, when the save declares one.
    `authoredOpenings` present as an array is the signal; absent means the
    save says nothing about openings and the stored ones stay. */
function readOpenings(body: Record<string, unknown>): AuthoredOpenings | undefined {
  if (!Array.isArray(body.authoredOpenings)) return undefined;

  const authored = (body.authoredOpenings as unknown[]).flatMap((value) => {
    const record = value as { edge?: unknown; offset?: unknown; width?: unknown; kind?: unknown };
    const edge = Number(record?.edge);
    const offset = Number(record?.offset);
    const width = Number(record?.width);
    return Number.isInteger(edge) && edge >= 0 && Number.isFinite(offset) && Number.isFinite(width) && typeof record?.kind === "string"
      ? [{ edge, offset, width, kind: record.kind }]
      : [];
  });

  const surfaces = (value: unknown): OpeningSurface[] =>
    Array.isArray(value) ? value.flatMap((v) => readSurface(v) ?? []) : [];

  return {
    authored,
    doors: surfaces(body.doors),
    windows: surfaces(body.windows),
    passages: surfaces(body.openings),
  };
}

/** Rename a room, move it to another floor, or recolour it on the plan. The
    measurements themselves are a record of what was scanned and are
    deliberately not editable. */
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
      await saveEditedPolygon(id, polygon, locked, readOpenings(body));
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
      ...(typeof body.roomType === "string" || body.roomType === null
        ? { roomType: body.roomType as string | null }
        : {}),
      // null is meaningful here and must survive: it means "go back to the
      // room type's default", which is not the same as zero.
      ...(body.livingPercent === null || Number.isFinite(Number(body.livingPercent))
        ? { livingPercent: body.livingPercent === null ? null : Number(body.livingPercent) }
        : {}),
      ...(typeof body.roomColor === "string" || body.roomColor === null
        ? { roomColor: body.roomColor as string | null }
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
