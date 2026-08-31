import AskClaude from "@/components/admin/AskClaude";
import Link from "next/link";
import AdminNotice from "@/components/admin/AdminNotice";
import { countClients } from "@/lib/crm/clients";
import { countQuotesByStatus } from "@/lib/crm/quotes";
import { countJobsByStatus, listVisitsBetween, type ScheduledVisit } from "@/lib/crm/jobs";
import { receivablesSummary } from "@/lib/crm/invoices";
import { countOpenOwnerTasks } from "@/lib/crm/tasks";
import { formatMoney, parseMoneyToCents } from "@/lib/crm/money";
import { isConfigured as isStoreConfigured, listLeads, type StoredLead } from "@/lib/leadStore";

/**
 * Home — the Jobber-dashboard idiom applied to what this business actually
 * has today.
 *
 * Jobber's Home is: greeting, today's appointments, the workflow funnel
 * (Requests → Quotes → Jobs → Invoices), a to-do list, business-at-a-glance
 * numbers, recent activity. Here the funnel starts at Leads because that is
 * our request object.
 *
 * Every number on this page is computed from real rows. Where a figure is an
 * AI estimate rather than an invoiced amount it says so, because a dashboard
 * that silently promotes estimates to revenue is lying to its one user.
 */

export const dynamic = "force-dynamic";

const OPEN_STATUSES = new Set(["new", "contacted", "quoted"]);

/** The business runs on Montreal time; the server runs on UTC. */
const TZ = "America/Toronto";

export default async function AdminHomePage() {
  if (!isStoreConfigured) {
    return (
      <AdminNotice title="No database connected yet">
        Set <code className="font-mono text-brand-blue">SUPABASE_URL</code> and{" "}
        <code className="font-mono text-brand-blue">SUPABASE_SERVICE_ROLE_KEY</code>, run the
        migrations, and this dashboard fills itself in.
      </AdminNotice>
    );
  }

  // A ±36h window is queried and then narrowed to the Montreal calendar day —
  // querying "today" directly would need the UTC offset, which flips with DST.
  const now = Date.now();
  const todayKey = new Date(now).toLocaleDateString("en-CA", { timeZone: TZ });

  let leads: StoredLead[] = [];
  let clients = 0;
  let quoteCounts: Record<string, number> = {};
  let jobCounts: Record<string, number> = {};
  let receivables = { outstandingCents: 0, overdueCents: 0, count: 0 };
  // Null means the visits table isn't reachable (migration not run yet) —
  // distinct from an empty day, which is a real answer worth showing.
  let visitsWindow: ScheduledVisit[] | null = [];
  // Same null-means-unreachable rule as visits: migration 0017 is run by hand,
  // and a "0 tasks" card would read as an empty list rather than no list.
  let openTasks: number | null = null;
  let error: string | null = null;
  try {
    // Each of these degrades to a zero on its own rather than failing the
    // page: a migration that hasn't run yet should grey out one card, not
    // take down the dashboard.
    [leads, clients, quoteCounts, jobCounts, receivables, visitsWindow, openTasks] =
      await Promise.all([
        listLeads(500),
        countClients(),
        countQuotesByStatus().catch(() => ({})),
        countJobsByStatus().catch(() => ({})),
        receivablesSummary().catch(() => ({ outstandingCents: 0, overdueCents: 0, count: 0 })),
        listVisitsBetween(
          new Date(now - 36 * 3_600_000).toISOString(),
          new Date(now + 36 * 3_600_000).toISOString(),
        ).catch(() => null),
        countOpenOwnerTasks().catch(() => null),
      ]);
  } catch (err) {
    error = err instanceof Error ? err.message : "Could not load the dashboard";
  }

  if (error) {
    return (
      <AdminNotice title="Could not reach the database">
        {error}. If the project has been idle for over a week it may be paused — open the Supabase
        dashboard to resume it.
      </AdminNotice>
    );
  }

  // --- Figures, all derived from real rows -------------------------------
  const open = leads.filter((l) => OPEN_STATUSES.has(l.status));
  const unread = leads.filter((l) => !l.opened_at);
  const won = leads.filter((l) => l.status === "won");

  const sumExpected = (subset: StoredLead[]) =>
    subset.reduce((sum, lead) => sum + (parseMoneyToCents(lead.estimate_expected ?? "") ?? 0), 0);

  const openValueCents = sumExpected(open);
  const wonValueCents = sumExpected(won);

  const todaysVisits =
    visitsWindow?.filter(
      (visit) =>
        new Date(visit.starts_at).toLocaleDateString("en-CA", { timeZone: TZ }) === todayKey,
    ) ?? null;

  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const last30 = leads.filter((l) => new Date(l.created_at).getTime() >= thirtyDaysAgo);

  // Greeting in the owner's timezone, not the server's — Vercel runs in UTC
  // and "Good morning" at 9pm reads as broken.
  const hour = Number(
    new Intl.DateTimeFormat("en-CA", {
      hour: "numeric",
      hour12: false,
      timeZone: "America/Toronto",
    }).format(new Date()),
  );
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const today = new Intl.DateTimeFormat("en-CA", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "America/Toronto",
  }).format(new Date());

  return (
    <div className="space-y-6">
      {/* The same composer as the native home screen (ANA-22). One question is
          the most common thing to want on either surface, and a desk is where
          the typed path is fastest. */}
      <AskClaude startOpen title="Ask Ana" />

      <div>
        <h2 className="font-heading text-xl font-bold text-charcoal">{greeting}, Artush</h2>
        <p className="mt-0.5 text-sm text-charcoal/50">{today}</p>
      </div>

      {/* Today's visits — what the day actually looks like, before any number
          about the pipeline. Hidden entirely when the visits table hasn't been
          migrated yet (the fetch degrades to null), because "no visits" and
          "no calendar" must not read the same. */}
      {todaysVisits !== null && (
        <section>
          <div className="flex items-baseline justify-between">
            <SectionTitle>Today</SectionTitle>
            <Link
              href="/admin/schedule"
              className="text-xs font-semibold text-brand-blue underline-offset-2 hover:underline"
            >
              Full schedule →
            </Link>
          </div>
          {todaysVisits.length === 0 ? (
            <div className="rounded-xl border border-black/5 bg-white p-4 text-sm text-charcoal/50 shadow-sm">
              Nothing on the calendar today.
            </div>
          ) : (
            <ul className="divide-y divide-black/5 overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
              {todaysVisits.map((visit) => (
                <VisitRow key={visit.id} visit={visit} />
              ))}
            </ul>
          )}
        </section>
      )}

      {/* The workflow funnel. One live stage; the rest are the roadmap. */}
      <section>
        <SectionTitle>Workflow</SectionTitle>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Link
            href="/admin/leads"
            className="group rounded-xl border border-black/5 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wide text-charcoal/45">
                Leads
              </span>
              {unread.length > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-green px-1.5 text-[11px] font-bold text-white">
                  {unread.length}
                </span>
              )}
            </div>
            <p className="mt-2 font-heading text-3xl font-bold text-charcoal">{open.length}</p>
            <p className="mt-0.5 text-xs text-charcoal/50">
              {openValueCents > 0
                ? `${formatMoney(openValueCents)} estimated`
                : "open in the pipeline"}
            </p>
          </Link>

          <FunnelCard
            href="/admin/quotes"
            label="Quotes"
            count={(quoteCounts.sent ?? 0) + (quoteCounts.viewed ?? 0)}
            note={
              quoteCounts.approved
                ? `${quoteCounts.approved} approved`
                : "awaiting a decision"
            }
          />
          <FunnelCard
            href="/admin/jobs"
            label="Jobs"
            count={(jobCounts.scheduled ?? 0) + (jobCounts.in_progress ?? 0)}
            note={
              jobCounts.unscheduled
                ? `${jobCounts.unscheduled} to schedule`
                : "active"
            }
          />
          <FunnelCard
            href="/admin/invoices"
            label="Invoices"
            count={receivables.count}
            note={
              receivables.outstandingCents > 0
                ? `${formatMoney(receivables.outstandingCents)} owing`
                : "all settled"
            }
            alarm={receivables.overdueCents > 0}
          />
        </div>
      </section>

      {/* The to-do list. Unread leads are the only thing that genuinely
          demands attention today, so that is all this shows — a padded-out
          task list would bury the one row that matters. */}
      <section>
        <SectionTitle>Needs attention</SectionTitle>
        {unread.length === 0 ? (
          <div className="rounded-xl border border-black/5 bg-white p-4 text-sm text-charcoal/50 shadow-sm">
            All caught up — every lead has been opened.
          </div>
        ) : (
          <ul className="divide-y divide-black/5 overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
            {unread.slice(0, 5).map((lead) => (
              <li key={lead.id}>
                <Link
                  href="/admin/leads"
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-black/[0.02]"
                >
                  <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-brand-green" />
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-charcoal" title={lead.name}>
                      {lead.name}
                    </span>
                    <span
                      className="block truncate text-xs text-charcoal/55"
                      title={lead.scope_summary || undefined}
                    >
                      {lead.scope_summary || "No scope recorded"}
                    </span>
                  </div>
                  <span className="shrink-0 text-xs text-charcoal/40">
                    {timeAgo(lead.created_at)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <SectionTitle>At a glance</SectionTitle>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Leads · 30 days" value={String(last30.length)} />
          <Stat
            label="Open pipeline"
            value={formatMoney(openValueCents)}
            note="AI estimates, pre-tax"
          />
          <Stat
            label="Won"
            value={String(won.length)}
            note={wonValueCents > 0 ? `${formatMoney(wonValueCents)} estimated` : undefined}
          />
          <Stat label="Clients" value={String(clients)} />
          {openTasks !== null && (
            <Stat
              href="/admin/tasks"
              label="Tasks"
              value={String(openTasks)}
              note={openTasks === 0 ? "all ticked off" : "dictated by phone"}
            />
          )}
          {receivables.overdueCents > 0 && (
            <Stat
              label="Overdue"
              value={formatMoney(receivables.overdueCents)}
              note="past the due date"
            />
          )}
        </div>
      </section>

      <section>
        <SectionTitle>Recent leads</SectionTitle>
        {leads.length === 0 ? (
          <div className="rounded-xl border border-black/5 bg-white p-4 text-sm text-charcoal/50 shadow-sm">
            Nothing yet — leads from the chat widget land here.
          </div>
        ) : (
          <ul className="divide-y divide-black/5 overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
            {leads.slice(0, 5).map((lead) => (
              <li key={lead.id}>
                <Link
                  href="/admin/leads"
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-black/[0.02]"
                >
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-charcoal" title={lead.name}>
                      {lead.name}
                    </span>
                    <span
                      className="block truncate text-xs text-charcoal/55"
                      title={lead.scope_summary || undefined}
                    >
                      {lead.scope_summary || "No scope recorded"}
                    </span>
                  </div>
                  <StatusChip status={lead.status} />
                  <span className="w-16 shrink-0 text-right text-xs text-charcoal/40">
                    {timeAgo(lead.created_at)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-charcoal/45">{children}</h3>
  );
}

/**
 * One of today's visits. Same done/scheduled distinction as the schedule page
 * — "overdue" can't happen here, because everything in this list is today's.
 */
function VisitRow({ visit }: { visit: ScheduledVisit }) {
  const done = Boolean(visit.completed_at);
  const time = visit.all_day
    ? "All day"
    : new Date(visit.starts_at).toLocaleTimeString("en-CA", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: TZ,
      });
  const title = visit.title || visit.job_title || `Job #${visit.job_number}`;

  return (
    <li>
      <Link
        href={`/admin/jobs/${visit.job_id}`}
        className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-black/[0.02]"
      >
        <span className="w-12 shrink-0 text-xs font-bold tabular-nums text-charcoal/60">
          {time}
        </span>
        <div className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-charcoal" title={title}>
            {title}
          </span>
          <span
            className="block truncate text-xs text-charcoal/55"
            title={[visit.client_name, visit.address].filter(Boolean).join(" · ")}
          >
            {[visit.client_name, visit.address].filter(Boolean).join(" · ")}
          </span>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
            done ? "bg-green-100 text-green-800" : "bg-brand-blue/[0.08] text-brand-blue"
          }`}
        >
          {done ? "Done" : "Scheduled"}
        </span>
      </Link>
    </li>
  );
}

/** One stage of the workflow funnel. */
function FunnelCard({
  href,
  label,
  count,
  note,
  alarm,
}: {
  href: string;
  label: string;
  count: number;
  note: string;
  alarm?: boolean;
}) {
  return (
    <Link
      href={href}
      className="group rounded-xl border border-black/5 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
    >
      <span className="text-xs font-bold uppercase tracking-wide text-charcoal/45">{label}</span>
      <p className="mt-2 font-heading text-3xl font-bold text-charcoal">{count}</p>
      <p className={`mt-0.5 text-xs ${alarm ? "font-semibold text-red-700" : "text-charcoal/50"}`}>
        {note}
      </p>
    </Link>
  );
}

/**
 * One at-a-glance figure. `href` turns it into a link where there is a screen
 * to send the reader to; the rest stay plain, because a card that looks
 * clickable and isn't costs a tap and a moment of doubt.
 */
function Stat({
  label,
  value,
  note,
  href,
}: {
  label: string;
  value: string;
  note?: string;
  href?: string;
}) {
  const body = (
    <>
      <span className="text-xs font-bold uppercase tracking-wide text-charcoal/45">{label}</span>
      <p className="mt-2 font-heading text-2xl font-bold text-charcoal">{value}</p>
      {note && <p className="mt-0.5 text-[11px] text-charcoal/40">{note}</p>}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="rounded-xl border border-black/5 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
      >
        {body}
      </Link>
    );
  }

  return <div className="rounded-xl border border-black/5 bg-white p-4 shadow-sm">{body}</div>;
}

const STATUS_STYLE: Record<string, string> = {
  new: "bg-brand-blue/[0.08] text-brand-blue",
  contacted: "bg-amber-100 text-amber-800",
  quoted: "bg-violet-100 text-violet-800",
  won: "bg-green-100 text-green-800",
  lost: "bg-black/[0.05] text-charcoal/50",
};

// Same wording as the pipeline view — "contacted" is labelled "Called" there,
// and the dashboard using a different word for the same state reads as two
// different states.
const STATUS_LABEL: Record<string, string> = {
  new: "New",
  contacted: "Called",
  quoted: "Quoted",
  won: "Won",
  lost: "Lost",
};

function StatusChip({ status }: { status: string }) {
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
        STATUS_STYLE[status] ?? STATUS_STYLE.new
      }`}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

function timeAgo(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}
