import { guarded } from "../guard";
import { listProjects } from "@/lib/crm/projects";

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
    })),
  }));
}
