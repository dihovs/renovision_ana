import { NextResponse } from "next/server";
import { isSignedIn } from "@/lib/adminAuth";
import { isConfigured, MigrationPendingError } from "@/lib/crm/db";
import { addProjectFile, MAX_PROJECT_FILE_BYTES } from "@/lib/crm/projects";

/**
 * One file per request, into the project's folder in the private bucket.
 *
 * A route handler rather than a server action on purpose: server action
 * bodies are capped at 1 MB by default and raising that is a next.config
 * change, while a route handler takes the platform's full ~4.5 MB request
 * budget. One file per request keeps each upload inside that budget and
 * means a flaky connection costs one photo, not the whole batch.
 *
 * The admin layout only guards rendering — an HTTP endpoint is public until
 * it checks the session itself, so that comes first.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isSignedIn())) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }
  if (!isConfigured) {
    return NextResponse.json({ error: "Database is not configured" }, { status: 503 });
  }

  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Unknown project" }, { status: 400 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file in the request" }, { status: 400 });
  }

  // Measure what actually arrived — file.size is the browser's claim.
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.byteLength === 0) {
    return NextResponse.json({ error: "The file is empty" }, { status: 400 });
  }
  if (bytes.byteLength > MAX_PROJECT_FILE_BYTES) {
    return NextResponse.json(
      {
        error: `File is too big — the limit is ${Math.floor(
          MAX_PROJECT_FILE_BYTES / (1024 * 1024),
        )} MB per file`,
      },
      { status: 413 },
    );
  }

  const note = String(form.get("note") ?? "")
    .trim()
    .slice(0, 500);

  try {
    const fileId = await addProjectFile(id, {
      bytes,
      filename: file.name || "file",
      contentType: file.type,
      note: note || null,
    });
    return NextResponse.json({ ok: true, fileId });
  } catch (err) {
    if (err instanceof MigrationPendingError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    // A foreign-key failure here means the project id was wrong or deleted
    // mid-upload; anything else is a genuine server problem. Either way the
    // message is safe: these errors describe our own database, not the user.
    const message = err instanceof Error ? err.message : "Upload failed";
    console.error("[projects] upload failed:", { projectId: id, message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
