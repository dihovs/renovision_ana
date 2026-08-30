import { getCrewToken } from "@/lib/crm/crewView";
import { listJobDispatches } from "@/lib/crm/dispatch";
import { contactLabel, listDispatchableContacts } from "@/lib/whatsapp/store";
import { notifyCrewAction } from "@/app/(internal)/admin/jobs/actions";
import NotifyCrew, { type CrewCandidate, type DispatchHistoryRow } from "./NotifyCrew";

/**
 * Loads what the dispatch panel needs, and disappears when the migration that
 * backs it has not run.
 *
 * Same rule as JobThread: a job page must not break because an optional
 * integration is half-installed. Everything here is wrapped rather than trusted,
 * because this is the newest table in the schema and migrations here are applied
 * by hand.
 */
export default async function CrewDispatch({ jobId }: { jobId: string }) {
  let candidates: CrewCandidate[] = [];
  try {
    candidates = (await listDispatchableContacts()).map((contact) => ({
      id: contact.id,
      name: contactLabel(contact),
      role: contact.role,
      optedInAt: contact.opted_in_at,
    }));
  } catch {
    return null;
  }

  const [dispatches, token] = await Promise.all([
    listJobDispatches(jobId),
    getCrewToken(jobId),
  ]);

  const byId = new Map(candidates.map((c) => [c.id, c.name]));
  const history: DispatchHistoryRow[] = dispatches.map((row) => ({
    id: row.id,
    name: (row.contact_id && byId.get(row.contact_id)) || "Someone no longer in the list",
    kind: row.kind,
    channel: row.channel,
    sentAt: row.sent_at,
    state: row.failed_at ? "failed" : row.read_at ? "read" : row.delivered_at ? "delivered" : "sent",
    detail: row.error_detail,
  }));

  const base = (process.env.CREW_LINK_BASE_URL?.trim() || "https://www.renovisionana.ca/crew").replace(/\/$/, "");

  return (
    <NotifyCrew
      candidates={candidates}
      history={history}
      action={notifyCrewAction.bind(null, jobId)}
      crewUrl={token ? `${base}/${token}` : null}
    />
  );
}
