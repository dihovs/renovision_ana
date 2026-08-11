import Link from "next/link";
import AdminNotice from "@/components/admin/AdminNotice";
import { SITE_PHONE } from "@/lib/constants";
import { listVisitsBetween, type ScheduledVisit } from "@/lib/crm/jobs";
import { countOpenOwnerTasks } from "@/lib/crm/tasks";
import { isConfigured as isStoreConfigured, listLeads } from "@/lib/leadStore";

/**
 * The native app's landing screen — not a smaller dashboard, a different one.
 *
 * `/admin` answers "how is the business doing"; this answers "what do I do
 * right now", which on a job site is: talk to Ana, or see today. Everything
 * the dense dashboard shows — the funnel, the at-a-glance figures, recent
 * leads — is still one tap away in the rail. It just isn't the first thing a
 * phone screen has to justify itself against.
 *
 * Reached two ways: `capacitor.config.ts` points the app here directly, and
 * AdminShell sends "Home" here instead of `/admin` when running native — see
 * both for why this needed to be a real route rather than a client redirect.
 */

export const dynamic = "force-dynamic";

const TZ = "America/Toronto";

export default async function MobileHomePage() {
  if (!isStoreConfigured) {
    return (
      <AdminNotice title="No database connected yet">
        Set <code className="font-mono text-brand-blue">SUPABASE_URL</code> and{" "}
        <code className="font-mono text-brand-blue">SUPABASE_SERVICE_ROLE_KEY</code> to turn this
        on.
      </AdminNotice>
    );
  }

  const now = Date.now();
  const todayKey = new Date(now).toLocaleDateString("en-CA", { timeZone: TZ });

  let unreadLeads = 0;
  let todaysVisits: ScheduledVisit[] | null = null;
  let openTasks: number | null = null;
  try {
    const [leads, visitsWindow, tasks] = await Promise.all([
      listLeads(500).catch(() => []),
      // ±36h then narrowed to the Montreal calendar day, same as the dense
      // dashboard — querying "today" directly needs the UTC offset, which
      // flips with DST.
      listVisitsBetween(
        new Date(now - 36 * 3_600_000).toISOString(),
        new Date(now + 36 * 3_600_000).toISOString(),
      ).catch(() => null),
      countOpenOwnerTasks().catch(() => null),
    ]);
    unreadLeads = leads.filter((l) => !l.opened_at).length;
    todaysVisits =
      visitsWindow?.filter(
        (visit) =>
          new Date(visit.starts_at).toLocaleDateString("en-CA", { timeZone: TZ }) === todayKey,
      ) ?? null;
    openTasks = tasks;
  } catch {
    // Each piece already degrades on its own above; a total failure here
    // still leaves the Ana button — the one thing this screen cannot lose.
  }

  const hour = Number(
    new Intl.DateTimeFormat("en-CA", { hour: "numeric", hour12: false, timeZone: TZ }).format(
      new Date(),
    ),
  );
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-6 pb-4">
      <h2 className="font-heading text-2xl font-bold text-charcoal">{greeting}, Artush</h2>

      {/* The two heroes. Talk to Ana and Call are the two things this app
          exists to make instant — both above the fold, both full-size, so
          neither is a smaller second choice under the other. */}
      <div className="space-y-3">
        <Link
          href="/admin/ana"
          className="group flex items-center gap-4 rounded-3xl bg-brand-blue p-6 shadow-lg shadow-brand-blue/20 transition-transform active:scale-[0.98]"
        >
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white/15">
            <MicIcon />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-heading text-xl font-bold text-white">Talk to Ana</span>
            <span className="block text-sm text-white/70">Voice or typed — she knows the CRM</span>
          </span>
          <span className="shrink-0 text-white/60">
            <ChevronIcon />
          </span>
        </Link>

        <Link
          href="/admin/phone"
          className="group flex items-center gap-4 rounded-3xl bg-brand-green p-6 shadow-lg shadow-brand-green/20 transition-transform active:scale-[0.98]"
        >
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white/15">
            <PhoneHeroIcon />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-heading text-xl font-bold text-white">Call</span>
            <span className="block text-sm text-white/70">Keypad or contacts — from {SITE_PHONE}</span>
          </span>
          <span className="shrink-0 text-white/60">
            <ChevronIcon />
          </span>
        </Link>
      </div>

      {/* Today. The one list this screen keeps, because "what's happening
          today" is a different question from "how is the pipeline doing" —
          the dense dashboard answers the second, this answers the first. */}
      <section>
        <div className="flex items-baseline justify-between px-1">
          <h3 className="text-xs font-bold uppercase tracking-wide text-charcoal/45">Today</h3>
          <Link href="/admin/schedule" className="text-xs font-semibold text-brand-blue">
            Full schedule
          </Link>
        </div>
        {todaysVisits === null ? null : todaysVisits.length === 0 ? (
          <div className="mt-2 rounded-2xl border border-black/5 bg-white p-5 text-sm text-charcoal/50 shadow-sm">
            Nothing on the calendar today.
          </div>
        ) : (
          <ul className="mt-2 space-y-2">
            {todaysVisits.map((visit) => (
              <VisitCard key={visit.id} visit={visit} />
            ))}
          </ul>
        )}
      </section>

      {/* One glance row, not four. Only the numbers that mean "go do
          something" earn a place here; everything else is in the rail. */}
      <div className="grid grid-cols-2 gap-3">
        <GlanceTile
          href="/admin/leads"
          label="Needs attention"
          value={unreadLeads}
          tone={unreadLeads > 0 ? "alert" : "calm"}
        />
        {openTasks !== null && (
          <GlanceTile
            href="/admin/tasks"
            label="Open tasks"
            value={openTasks}
            tone={openTasks > 0 ? "info" : "calm"}
          />
        )}
      </div>
    </div>
  );
}

function VisitCard({ visit }: { visit: ScheduledVisit }) {
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
        className="flex items-center gap-4 rounded-2xl border border-black/5 bg-white p-4 shadow-sm transition-transform active:scale-[0.98]"
      >
        <span
          className={`flex h-12 w-14 shrink-0 flex-col items-center justify-center rounded-xl text-xs font-bold tabular-nums ${
            done ? "bg-green-100 text-green-800" : "bg-brand-blue/[0.08] text-brand-blue"
          }`}
        >
          {time}
        </span>
        <div className="min-w-0 flex-1">
          <span className="block truncate text-base font-bold text-charcoal" title={title}>
            {title}
          </span>
          <span
            className="block truncate text-sm text-charcoal/55"
            title={[visit.client_name, visit.address].filter(Boolean).join(" · ")}
          >
            {[visit.client_name, visit.address].filter(Boolean).join(" · ") || "No address on file"}
          </span>
        </div>
        <span className="shrink-0 text-charcoal/25">
          <ChevronIcon />
        </span>
      </Link>
    </li>
  );
}

function GlanceTile({
  href,
  label,
  value,
  tone,
}: {
  href: string;
  label: string;
  value: number;
  tone: "alert" | "info" | "calm";
}) {
  const toneClass =
    tone === "alert"
      ? "border-brand-green/30 bg-brand-green/[0.06]"
      : tone === "info"
        ? "border-brand-blue/20 bg-brand-blue/[0.05]"
        : "border-black/5 bg-white";
  return (
    <Link
      href={href}
      className={`rounded-2xl border p-4 shadow-sm transition-transform active:scale-[0.98] ${toneClass}`}
    >
      <p className="font-heading text-3xl font-bold text-charcoal">{value}</p>
      <p className="mt-0.5 text-xs font-semibold text-charcoal/55">{label}</p>
    </Link>
  );
}

function MicIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" aria-hidden>
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4" strokeLinecap="round" />
    </svg>
  );
}

function PhoneHeroIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" aria-hidden>
      <path
        d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
