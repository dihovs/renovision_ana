import { guarded } from "../guard";
import { listLeads } from "@/lib/leadStore";

/**
 * The lead pipeline, trimmed for a phone list.
 *
 * The full record carries the whole AI-chat project brief and photo paths;
 * the list needs who, where, how urgent, what stage and what it might be
 * worth. Detail stays behind the row tap.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return guarded(async () => ({
    leads: (await listLeads(200)).map((lead) => ({
      id: lead.id,
      createdAt: lead.created_at,
      name: lead.name,
      phone: lead.phone,
      email: lead.email,
      address: lead.address,
      status: lead.status,
      source: lead.source,
      isEmergency: lead.is_emergency ?? false,
      scopeSummary: lead.scope_summary,
      estimateExpected: lead.estimate_expected,
      // Read/unread on leads is real state here, unlike SMS: opened_at
      // exists precisely so the pipeline can show what nobody has looked at.
      unopened: lead.opened_at === null,
      notes: lead.notes,
    })),
  }));
}
