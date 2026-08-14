import { guarded } from "../../guard";
import { db } from "@/lib/crm/db";

/** Remove one entry from the call log — the Delete action on a call row.
    The recording of the business's OWN line is the one thing an operator
    should be able to prune; nothing else hangs off a calls row. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return guarded(async () => {
    const client = db();
    if (!client) throw new Error("Database is not configured");
    const { error } = await client.from("calls").delete().eq("id", id);
    if (error) throw new Error(`Could not delete the call: ${error.message}`);
    return { ok: true };
  });
}
