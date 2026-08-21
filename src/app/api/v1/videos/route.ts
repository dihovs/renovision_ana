import { NextResponse } from "next/server";
import { guarded } from "../guard";
import { recordUploadedFile } from "@/lib/crm/projects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Step two of a video upload: the phone already PUT the bytes straight to
 * Storage using the signed URL from `POST /api/v1/videos/upload-url`. This
 * only records the row — same two-step shape the thumbnail upload uses
 * `/api/v1/photos` for, except a video's bytes never pass through this
 * server at all.
 */
export async function POST(request: Request) {
  let body: {
    projectId?: unknown;
    path?: unknown;
    filename?: unknown;
    sizeBytes?: unknown;
    contentType?: unknown;
    roomScanId?: unknown;
    affectedAreaId?: unknown;
    wallIndex?: unknown;
    durationSeconds?: unknown;
    thumbnailPath?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const projectId = typeof body.projectId === "string" ? body.projectId : "";
  const path = typeof body.path === "string" ? body.path : "";
  if (!projectId || !path) {
    return NextResponse.json({ error: "projectId and path are required." }, { status: 400 });
  }

  const wallIndex =
    typeof body.wallIndex === "number" && Number.isInteger(body.wallIndex) ? body.wallIndex : null;

  return guarded(async () => ({
    id: await recordUploadedFile(projectId, {
      path,
      filename: typeof body.filename === "string" ? body.filename : "video.mov",
      sizeBytes: typeof body.sizeBytes === "number" ? body.sizeBytes : 0,
      contentType: typeof body.contentType === "string" ? body.contentType : "video/quicktime",
      roomScanId: typeof body.roomScanId === "string" ? body.roomScanId : null,
      affectedAreaId: typeof body.affectedAreaId === "string" ? body.affectedAreaId : null,
      wallIndex,
      durationSeconds: typeof body.durationSeconds === "number" ? body.durationSeconds : null,
      thumbnailPath: typeof body.thumbnailPath === "string" ? body.thumbnailPath : null,
    }),
  }));
}
