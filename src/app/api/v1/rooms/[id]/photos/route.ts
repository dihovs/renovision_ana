import { NextResponse } from "next/server";
import { guarded } from "../../../guard";
import {
  addProjectFile,
  listRoomFiles,
  MAX_PROJECT_FILE_BYTES,
  signProjectFileUrls,
} from "@/lib/crm/projects";
import { getRoomScanProject } from "@/lib/crm/roomScans";

/**
 * Photos of one room.
 *
 * Multipart rather than JSON: this is a camera roll image going up from a
 * phone, and base64 in a JSON body would inflate it by a third for no
 * benefit. The bytes are read server-side and the recorded size is what
 * actually arrived, never what the browser claimed.
 */

/** Signed per request, never persisted — the same rule as everywhere else. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return guarded(async () => {
    const files = await listRoomFiles(id);
    const urls = await signProjectFileUrls(files.map((file) => file.storage_path));
    return {
      photos: files.map((file) => ({
        id: file.id,
        filename: file.filename,
        note: file.note,
        uploaded_at: file.uploaded_at,
        content_type: file.content_type,
        url: urls[file.storage_path] ?? null,
      })),
    };
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected a file upload." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "No file was attached." }, { status: 400 });
  }
  if (file.size > MAX_PROJECT_FILE_BYTES) {
    return NextResponse.json(
      { error: `That file is over the ${Math.round(MAX_PROJECT_FILE_BYTES / 1024 / 1024)} MB limit.` },
      { status: 413 },
    );
  }

  const areaId = form.get("affectedAreaId");
  const note = form.get("note");

  return guarded(async () => {
    // A photo belongs to a project through its room. Looking the project up
    // rather than trusting a field means a photo can never be filed against
    // a project its room does not belong to.
    const projectId = await getRoomScanProject(id);
    if (!projectId) throw new Error("That room no longer exists.");

    const stored = await addProjectFile(projectId, {
      bytes: Buffer.from(await file.arrayBuffer()),
      filename: file.name || "photo.jpg",
      contentType: file.type,
      note: typeof note === "string" ? note : null,
      roomScanId: id,
      affectedAreaId: typeof areaId === "string" && areaId ? areaId : null,
    });
    return { id: stored.id };
  });
}
