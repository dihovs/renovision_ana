import { guarded } from "../../../guard";
import { duplicateProject } from "@/lib/crm/projects";

/**
 * Copy a project's layout onto a new job — the card menu's `Duplicate`.
 *
 * POST rather than PATCH because it CREATES something: the response is the
 * new project's id, which the phone pushes straight onto so the next tap is
 * the copy rather than a hunt for it.
 *
 * `duplicateProject` copies the drawing and not the evidence — see its own
 * documentation for why copying a drying log into another address would be
 * fabricating a record rather than duplicating one.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return guarded(async () => ({ id: await duplicateProject(id) }));
}
