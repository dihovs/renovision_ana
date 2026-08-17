import { NextResponse } from "next/server";
import { guarded } from "../../guard";
import { PROJECT_STATUSES, updateProjectStatus, type ProjectStatus } from "@/lib/crm/projects";

/**
 * Archive a project — the phone's cleanup path.
 *
 * Not a delete: a project carries rooms, scans and photos underneath it, and
 * cascading a hard delete through all of that from a single tap is a much
 * bigger blast radius than "get this off my list." Archiving already exists
 * server-side and `listProjects` already excludes archived projects — the
 * same mechanism the reference app's own "Archived" filter implies it uses —
 * so a phone that archives gets the same result a delete would have shown on
 * this screen, reversibly.
 *
 * Only `status` is accepted here; a full project edit is a bigger surface
 * than a phone picker needs and belongs to `updateProjectCustom` instead.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const status = typeof body.status === "string" ? body.status : "";
  if (!PROJECT_STATUSES.includes(status as ProjectStatus)) {
    return NextResponse.json(
      { error: `status must be one of: ${PROJECT_STATUSES.join(", ")}` },
      { status: 400 },
    );
  }

  return guarded(async () => {
    await updateProjectStatus(id, status as ProjectStatus);
    return { ok: true };
  });
}
