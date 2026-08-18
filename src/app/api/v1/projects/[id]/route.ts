import { NextResponse } from "next/server";
import { guarded } from "../../guard";
import {
  PROJECT_STATUSES,
  assignProject,
  getProject,
  setProjectFavorite,
  updateProjectDetails,
  updateProjectStatus,
  type ProjectStatus,
} from "@/lib/crm/projects";

/**
 * One project, with the fields the phone's detail screen shows that the list
 * payload deliberately omits — the description and the property address.
 *
 * Separate from the list because a list of 200 projects has no business
 * carrying 200 descriptions, and because this screen needs to re-read after
 * an edit without refetching everything.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return guarded(async () => {
    const project = await getProject(id);
    if (!project) return { project: null };
    return {
      project: {
        id: project.id,
        name: project.name,
        description: project.description ?? null,
        createdAt: project.created_at,
        updatedAt: project.updated_at,
        addressLine1: project.address_line1 ?? null,
        addressCity: project.address_city ?? null,
        addressPostal: project.address_postal ?? null,
        assignedTo: project.assigned_to ?? null,
        favorite: project.is_favorite ?? false,
      },
    };
  });
}

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
  const DETAIL_KEYS = [
    "name", "description", "addressLine1", "addressCity", "addressPostal",
  ] as const;
  const details = DETAIL_KEYS.filter((key) => key in body);

  if (!hasStatus && !hasAssignee && !hasFavorite && details.length === 0) {
    return NextResponse.json(
      { error: "Send status, assignedTo, favorite, description or an address field." },
      { status: 400 },
    );
  }

  for (const key of details) {
    if (body[key] !== null && typeof body[key] !== "string") {
      return NextResponse.json({ error: `${key} must be text or null.` }, { status: 400 });
    }
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
    if (details.length > 0) {
      await updateProjectDetails(
        id,
        Object.fromEntries(details.map((key) => [key, body[key] as string | null])),
      );
    }
    return { ok: true };
  });
}
