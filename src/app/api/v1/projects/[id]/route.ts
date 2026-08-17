import { NextResponse } from "next/server";
import { guarded } from "../../guard";
import {
  PROJECT_STATUSES,
  assignProject,
  setProjectFavorite,
  updateProjectStatus,
  type ProjectStatus,
} from "@/lib/crm/projects";

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
 * The same route carries the rest of the card's overflow menu, because they
 * are all one-field edits to the same row: `assignedTo` is `Move` (a name —
 * see migration 0035 for why there is no staff id to send), and `favorite`
 * is the star. Each key is optional and only what is PRESENT is written, so
 * starring a project cannot silently clear who it belongs to.
 *
 * A full project edit is a bigger surface than a phone picker needs and
 * belongs to `updateProjectCustom` instead.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const hasStatus = "status" in body;
  const hasAssignee = "assignedTo" in body;
  const hasFavorite = "favorite" in body;

  if (!hasStatus && !hasAssignee && !hasFavorite) {
    return NextResponse.json(
      { error: "Send status, assignedTo or favorite." },
      { status: 400 },
    );
  }

  if (hasStatus && !PROJECT_STATUSES.includes(body.status as ProjectStatus)) {
    return NextResponse.json(
      { error: `status must be one of: ${PROJECT_STATUSES.join(", ")}` },
      { status: 400 },
    );
  }
  // null is meaningful here — it unassigns — so only a wrong TYPE is refused.
  if (hasAssignee && body.assignedTo !== null && typeof body.assignedTo !== "string") {
    return NextResponse.json(
      { error: "assignedTo must be a name or null." },
      { status: 400 },
    );
  }
  if (hasFavorite && typeof body.favorite !== "boolean") {
    return NextResponse.json({ error: "favorite must be true or false." }, { status: 400 });
  }

  return guarded(async () => {
    if (hasStatus) await updateProjectStatus(id, body.status as ProjectStatus);
    if (hasAssignee) await assignProject(id, body.assignedTo as string | null);
    if (hasFavorite) await setProjectFavorite(id, body.favorite as boolean);
    return { ok: true };
  });
}
