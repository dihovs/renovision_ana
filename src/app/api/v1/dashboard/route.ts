import { guarded } from "../guard";
import { db } from "@/lib/crm/db";
import { listProjects } from "@/lib/crm/projects";
import { listQuotes } from "@/lib/crm/quotes";
import { listInvoices } from "@/lib/crm/invoices";
import { unitDays, type EquipmentPlacement } from "@/lib/crm/dryingLog";
import { readSetting } from "@/lib/crm/settings";

/**
 * What the day looks like, in one request.
 *
 * Aggregated on the server rather than assembled on the phone. The home
 * screen needs six different figures, and six round trips over a job-site
 * connection is the difference between a screen that is useful and one the
 * operator stops opening.
 *
 * Every section degrades on its own. A missing table costs one figure, not
 * the whole screen — on a half-migrated database the home screen is exactly
 * when somebody needs to see what IS working.
 */
export const dynamic = "force-dynamic";

function startOfToday(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
}

function endOfToday(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
}

export async function GET() {
  return guarded(async () => {
    const client = db();

    const projects = await listProjects({ limit: 200 }).catch(() => []);
    const quotes = await listQuotes({ limit: 200 }).catch(() => []);
    const invoices = await listInvoices({ limit: 200 }).catch(() => []);

    // Equipment across every project at once — the per-project helper would
    // mean one query per job just to answer "what is still on site".
    let equipment: EquipmentPlacement[] = [];
    if (client) {
      const { data } = await client
        .from("equipment_placements")
        .select("*")
        .is("out_of_service_at", null);
      equipment = (data ?? []) as EquipmentPlacement[];
    }

    // Today's visits, so the first thing on the screen is where to be.
    let visits: { id: string; title: string | null; startsAt: string; done: boolean }[] = [];
    if (client) {
      const { data } = await client
        .from("visits")
        .select("id, title, starts_at, completed_at")
        .gte("starts_at", startOfToday())
        .lt("starts_at", endOfToday())
        .order("starts_at", { ascending: true });
      visits = (data ?? []).map((visit) => ({
        id: visit.id as string,
        title: visit.title as string | null,
        startsAt: visit.starts_at as string,
        done: visit.completed_at !== null,
      }));
    }

    // Calls nobody answered, which is the only part of the call log that is
    // a task rather than a record.
    let missedCalls = 0;
    if (client) {
      const { count } = await client
        .from("calls")
        .select("id", { count: "exact", head: true })
        .gte("started_at", startOfToday())
        .neq("status", "completed");
      missedCalls = count ?? 0;
    }

    /**
     * **The three badge counts, and why they are not the three counts above.**
     *
     * A badge means *new since you last looked* — that is the whole of what
     * makes an iPhone's red circle worth glancing at, and why it goes away
     * when you open the app. `missedCalls` is a different question: today's
     * unanswered calls, which stay a task after they have been read. Both
     * are wanted, so both are sent, and the home screen uses each where it
     * belongs — the badge for "new", the attention list for "outstanding".
     *
     * The seen marks live in `app_settings` rather than in a new column on
     * every message: one operator, one mark per surface, no migration.
     */
    const EPOCH = "1970-01-01T00:00:00.000Z";
    const [messagesSeenAt, callsSeenAt] = await Promise.all([
      readSetting<string>("messages_seen_at", EPOCH),
      readSetting<string>("calls_seen_at", EPOCH),
    ]);

    let unreadMessages = 0;
    let unseenCalls = 0;
    let newLeads = 0;
    if (client) {
      const [messages, calls, leadRows] = await Promise.all([
        client
          .from("sms_messages")
          .select("id", { count: "exact", head: true })
          .eq("direction", "inbound")
          .gt("created_at", messagesSeenAt),
        client
          .from("calls")
          .select("id", { count: "exact", head: true })
          .neq("status", "completed")
          .gt("started_at", callsSeenAt),
        // A lead nobody has opened yet. `opened_at` has been the read mark
        // since migration 0003 — the pipeline `status` answers a different
        // question and a lead can be unread and already contacted.
        client
          .from("leads")
          .select("id", { count: "exact", head: true })
          .is("opened_at", null),
      ]);
      unreadMessages = messages.count ?? 0;
      unseenCalls = calls.count ?? 0;
      newLeads = leadRows.count ?? 0;
    }

    const awaiting = quotes.filter((quote) =>
      ["sent", "viewed", "changes_requested"].includes(quote.status),
    );
    const outstanding = invoices.filter(
      (invoice) => invoice.total_cents - invoice.amount_paid_cents > 0 && invoice.status !== "draft",
    );
    const now = new Date();

    return {
      projects: {
        active: projects.filter((project) => project.status !== "done").length,
        total: projects.length,
        roomsMeasured: projects.reduce((sum, project) => sum + (project.room_count ?? 0), 0),
      },
      estimates: {
        awaiting: awaiting.length,
        awaitingCents: awaiting.reduce((sum, quote) => sum + quote.total_cents, 0),
      },
      invoices: {
        outstanding: outstanding.length,
        outstandingCents: outstanding.reduce(
          (sum, invoice) => sum + (invoice.total_cents - invoice.amount_paid_cents),
          0,
        ),
      },
      equipment: {
        running: equipment.reduce((sum, item) => sum + item.quantity, 0),
        unitDays: equipment.reduce((sum, item) => sum + unitDays(item, now), 0),
      },
      visits,
      missedCalls,
      unreadMessages,
      unseenCalls,
      newLeads,
    };
  });
}
