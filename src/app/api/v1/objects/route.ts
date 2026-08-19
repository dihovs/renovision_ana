import { NextResponse } from "next/server";
import { guarded } from "../guard";
import {
  createRoomObject,
  deleteRoomObject,
  listRoomObjects,
  updateRoomObject,
  DISPOSITIONS,
  type Disposition,
} from "@/lib/crm/roomObjects";

/**
 * Objects standing in a room — cabinets, toilets, vanities, appliances.
 *
 * ORD-40 / ORD-36 / S8. An object is a line item, not decoration: counted
 * when it is damaged or replaced, carrying what has to happen to it, and
 * includable or excludable like any other item. See `lib/crm/roomObjects`
 * for why it is a table of its own rather than more JSON on the scan.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const roomScanId = new URL(request.url).searchParams.get("roomScanId");
  if (!roomScanId) {
    return NextResponse.json({ error: "roomScanId is required." }, { status: 400 });
  }
  return guarded(async () => ({ objects: await listRoomObjects(roomScanId) }));
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const roomScanId = typeof body.roomScanId === "string" ? body.roomScanId : "";
  const kind = typeof body.kind === "string" ? body.kind.trim() : "";
  if (!roomScanId || !kind) {
    return NextResponse.json(
      { error: "roomScanId and kind are both required." },
      { status: 400 },
    );
  }

  // Dimensions are seeded from the catalogue on the phone, so a missing one
  // is a client bug rather than an operator's mistake — refused here so it
  // cannot become a zero-sized object nobody can find on the plan.
  const width = Number(body.width);
  const depth = Number(body.depth);
  const height = Number(body.height);
  if (![width, depth, height].every((n) => Number.isFinite(n) && n > 0)) {
    return NextResponse.json(
      { error: "An object needs a width, a depth and a height in metres." },
      { status: 400 },
    );
  }

  const disposition = DISPOSITIONS.includes(body.disposition as Disposition)
    ? (body.disposition as Disposition)
    : "none";

  return guarded(async () => ({
    id: await createRoomObject({
      roomScanId,
      kind,
      name: typeof body.name === "string" ? body.name : null,
      x: Number(body.x) || 0,
      y: Number(body.y) || 0,
      rotation: Number(body.rotation) || 0,
      width,
      depth,
      height,
      disposition,
      included: body.included !== false,
      quantity: Number(body.quantity) || 1,
      notes: typeof body.notes === "string" ? body.notes : null,
    }),
  }));
}

export async function PATCH(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  // Only the keys that actually arrived. An absent key means "not
  // mentioned", never "set to null" — the rule every /api/v1 route here
  // follows, and the one the Swift client's NullablePatch exists to respect.
  const number = (key: string) =>
    body[key] !== undefined && Number.isFinite(Number(body[key]))
      ? { [key]: Number(body[key]) }
      : {};

  return guarded(async () => {
    await updateRoomObject(id, {
      ...(typeof body.kind === "string" && body.kind ? { kind: body.kind } : {}),
      ...(body.name !== undefined ? { name: body.name as string | null } : {}),
      ...number("x"),
      ...number("y"),
      ...number("rotation"),
      ...number("width"),
      ...number("depth"),
      ...number("height"),
      ...number("quantity"),
      ...(DISPOSITIONS.includes(body.disposition as Disposition)
        ? { disposition: body.disposition as Disposition }
        : {}),
      ...(typeof body.included === "boolean" ? { included: body.included } : {}),
      ...(typeof body.sizeHandSet === "boolean" ? { sizeHandSet: body.sizeHandSet } : {}),
      ...(body.notes !== undefined ? { notes: body.notes as string | null } : {}),
    });
    return { updated: id };
  });
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });
  return guarded(async () => {
    await deleteRoomObject(id);
    return { deleted: id };
  });
}
