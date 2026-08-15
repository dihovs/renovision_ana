import { NextResponse } from "next/server";
import { guarded } from "../guard";
import { createProject, listProjects } from "@/lib/crm/projects";

/**
 * Projects the phone can scan into.
 *
 * Trimmed to what a picker needs — a scanner standing in a doorway wants a
 * name and a client, not a file library. Archived projects are excluded by
 * `listProjects` already, which is right here: you do not measure a
 * property that has been put away.
 */
export async function GET() {
  return guarded(async () => ({
    projects: (await listProjects({ limit: 200 })).map((project) => ({
      id: project.id,
      name: project.name,
      clientName: project.client_name,
      roomCount: project.room_count,
      // The geometry of the largest room, so a card can show the floor plan
      // rather than a grey box. `listProjects` already reads it for the web
      // list; forwarding it costs one embed that is already being made.
      largestRoom: project.largest_room?.geometry ?? null,
    })),
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
