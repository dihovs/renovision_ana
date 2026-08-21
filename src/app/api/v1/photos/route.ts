import { NextResponse } from "next/server";
import { guarded } from "../guard";
import {
  addProjectFile,
  deleteProjectFile,
  listProjectFiles, listRoomFiles,
  signProjectFileUrls,
  MAX_PROJECT_FILE_BYTES,
} from "@/lib/crm/projects";

/**
 * Photographs, filed against a room or a damaged area.
 *
 * Evidence is most of a restoration claim — nine of the twenty pages in the
 * report this app is measured against are photo grids — and a photo is worth
 * having only if it is attached to something. "Which room was this?" is a
 * question nobody can answer from a filename a week later.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const roomScanId = params.get("roomScanId");
  const projectId = params.get("projectId");
  if (!roomScanId && !projectId) {
    return NextResponse.json(
      { error: "Send roomScanId for a room's photos, or projectId for the job's own." },
      { status: 400 },
    );
  }
  const wallIndexParam = params.get("wallIndex");
  const wallIndex =
    wallIndexParam !== null && Number.isInteger(Number(wallIndexParam))
      ? Number(wallIndexParam)
      : undefined;
  // One damaged region's own photos — object-model §2b gives an area its own
  // Photos & Notes tab. Narrows the room's pile; it never widens it, so a
  // photo can still only be read through the room it was filed against.
  const affectedAreaId = params.get("affectedAreaId") || undefined;

  return guarded(async () => {
    // A room's photos, or the job's own — the second are exactly the ones
    // attached to no room, which `listProjectFiles` is the whole definition of.
    const files = roomScanId
      ? await listRoomFiles(roomScanId, wallIndex, affectedAreaId)
      : await listProjectFiles(projectId!);
    // Signed per request and never persisted — a stored URL outlives its own
    // expiry and starts serving 403s to a report nobody can regenerate.
    // Thumbnails are signed in the SAME batch as the main files, not a
    // second round trip — one request, whichever paths exist.
    const thumbnailPaths = files
      .map((file) => file.thumbnail_path)
      .filter((path): path is string => Boolean(path));
    const urls = await signProjectFileUrls([
      ...files.map((file) => file.storage_path),
      ...thumbnailPaths,
    ]);
    return {
      photos: files.map((file) => ({
        id: file.id,
        filename: file.filename,
        note: file.note,
        uploadedAt: file.uploaded_at,
        url: urls[file.storage_path] ?? null,
        contentType: file.content_type,
        durationSeconds: file.duration_seconds,
        thumbnailUrl: file.thumbnail_path ? (urls[file.thumbnail_path] ?? null) : null,
      })),
    };
  });
}

/**
 * Upload one photo. Multipart rather than base64 JSON: a phone photo is
 * two to five megabytes, and base64 inflates that by a third for no reason
 * on a connection that is already the bottleneck.
 */
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected a multipart upload." }, { status: 400 });
  }

  const projectId = String(form.get("projectId") ?? "");
  const roomScanId = String(form.get("roomScanId") ?? "");
  const affectedAreaId = String(form.get("affectedAreaId") ?? "");
  const wallIndexField = form.get("wallIndex");
  const wallIndex =
    typeof wallIndexField === "string" && Number.isInteger(Number(wallIndexField))
      ? Number(wallIndexField)
      : null;
  const note = String(form.get("note") ?? "");
  const file = form.get("file");

  if (!projectId) {
    return NextResponse.json({ error: "projectId is required." }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No photo was attached." }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  // Measured from what actually arrived, never from what the client claimed.
  if (bytes.byteLength > MAX_PROJECT_FILE_BYTES) {
    return NextResponse.json(
      { error: "That photo is too large. Take it again at a smaller size." },
      { status: 413 },
    );
  }

  return guarded(async () => ({
    id: await addProjectFile(projectId, {
      bytes,
      filename: file.name || "photo.jpg",
      contentType: file.type || "image/jpeg",
      note: note || null,
      roomScanId: roomScanId || null,
      affectedAreaId: affectedAreaId || null,
      wallIndex,
    }),
  }));
}

/**
 * Remove one photo, object and row together.
 *
 * Written for redaction, and that is the whole reason it exists. The phone's
 * photo editor blurs a document, a face or a plate and uploads the redacted
 * copy — and if the original stayed in the bucket, the redaction would be
 * decoration. What the operator did was not "make a censored copy"; it was
 * "this must not be readable", and only deleting the original says that.
 *
 * `deleteProjectFile` removes the storage object as well as the row, so
 * there is no signed URL left to hand out.
 *
 * The client uploads the redacted copy FIRST and calls this only once that
 * has succeeded. That order is deliberate: the failure it leaves behind is
 * two photos where there should be one, which anyone can see and fix, rather
 * than none at all, which loses evidence.
 */
export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required." }, { status: 400 });
  }
  return guarded(async () => {
    await deleteProjectFile(id);
    return { deleted: id };
  });
}
