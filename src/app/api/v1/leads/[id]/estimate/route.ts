import { guarded } from "../../../guard";
import { convertLeadToClient } from "@/lib/crm/clients";
import { startEstimateProject } from "@/lib/crm/startEstimate";
import { db } from "@/lib/crm/db";

/**
 * "Start estimate" on the phone's lead sheet: the lead becomes a customer
 * (convertLeadToClient — idempotent, the lead row kept and linked), then a
 * project on that customer's property carries the lead's own description so
 * the estimator's AI box opens with it. Nothing is priced here; the lead's
 * status is not moved (that stays his call).
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return guarded(async () => {
    const { id: clientId } = await convertLeadToClient(id);
    const { data } = await db()!.from("leads").select("scope_summary").eq("id", id).maybeSingle();
    const scope = (data?.scope_summary as string | null | undefined)?.trim() || null;
    const started = await startEstimateProject(clientId, {
      description: scope ? `Demande du client : ${scope}` : null,
    });
    return { ...started, clientId };
  });
}

export const dynamic = "force-dynamic";
