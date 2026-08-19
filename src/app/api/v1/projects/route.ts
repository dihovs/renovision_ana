import { NextResponse } from "next/server";
import { guarded } from "../guard";
import { createProject, listAssignees, listProjects } from "@/lib/crm/projects";

/**
 * Projects the phone can scan into.
 *
 * Trimmed to what a picker needs — a scanner standing in a doorway wants a
 * name and a client, not a file library. Archived projects are excluded by
 * `listProjects` by default, which is right: you do not measure a property
 * that has been put away.
 *
 * `?status=archived` asks for exactly those instead — what the grid's
 * `Archived` chip reads, and the only way back to a project put away by
 * mistake. Any other status value is ignored rather than refused: an
 * unrecognised filter should show the ordinary list, not an error screen on
 * a phone.
 */
export async function GET(request: Request) {
  const archived = new URL(request.url).searchParams.get("status") === "archived";
  return guarded(async () => ({
    projects: (await listProjects(
      archived ? { status: "archived", limit: 200 } : { limit: 200 },
    )).map((project) => ({
      id: project.id,
      name: project.name,
      clientName: project.client_name,
      roomCount: project.room_count,
      // The geometry of the largest room, so a card can show the floor plan
      // rather than a grey box. `listProjects` already reads it for the web
      // list; forwarding it costs one embed that is already being made.
      largestRoom: project.largest_room?.geometry ?? null,
      // Every room on the busiest storey, so the card can draw the property
      // rather than one room of it. `largestRoom` above stays for builds
      // that predate this and decode only that.
      floorRooms: project.floor_rooms.map((room) => ({
        geometry: room.geometry,
        planX: room.plan_x,
        planY: room.plan_y,
        // The fixtures in that room, so a card draws the toilet as well as
        // the walls — the owner's own ask, having seen them on the storey.
        objects: room.objects,
      })),
      assignedTo: project.assigned_to ?? null,
      favorite: project.is_favorite ?? false,
    })),
    // Names already used, for the assign sheet's suggestions — sent with the
    // list so opening that sheet costs no second round trip on a phone that
    // may be standing in a basement. See migration 0035: there is no staff
    // table, so this IS the roster.
    assignees: await listAssignees(),
  }));
}

/**
 * Start a project from the phone.
 *
 * A name is the only requirement, and the client is optional, because the
 * common case is standing at a property that has just flooded: the job
 * exists, the paperwork does not yet, and refusing to record it until a
 * customer has been created is how measurements end up in a notes app.
 */
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Give the project a name." }, { status: 400 });
  }

  return guarded(async () => ({
    id: await createProject({
      name,
      clientId: typeof body.clientId === "string" && body.clientId ? body.clientId : null,
      description: typeof body.description === "string" ? body.description : null,
    }),
  }));
}
