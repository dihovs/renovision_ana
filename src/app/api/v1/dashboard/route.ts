import { guarded } from "../guard";
import { db } from "@/lib/crm/db";
import { listProjects } from "@/lib/crm/projects";
import { listQuotes } from "@/lib/crm/quotes";
import { listInvoices } from "@/lib/crm/invoices";
import { unitDays, type EquipmentPlacement } from "@/lib/crm/dryingLog";

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
    };
  });
}
