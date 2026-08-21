import { NextResponse } from "next/server";
import { guarded } from "../../guard";
import { createUploadTarget } from "@/lib/crm/projects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Step one of a video upload: reserve a path and hand back a signed URL the
 * PHONE uploads directly to. A route handler's own request body is capped
 * around Vercel's ~4.5 MB platform limit — fine for a photo, nowhere near
 * enough for a clip — so this server never receives the video's bytes at
 * all. Call `POST /api/v1/videos` once the direct upload succeeds, to
 * record the row.
 */
export async function POST(request: Request) {
  let body: { projectId?: unknown; filename?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const projectId = typeof body.projectId === "string" ? body.projectId : "";
  const filename = typeof body.filename === "string" && body.filename.trim() ? body.filename : "video.mov";
  if (!projectId) {
    return NextResponse.json({ error: "projectId is required." }, { status: 400 });
  }

  return guarded(async () => createUploadTarget(projectId, filename));
}
