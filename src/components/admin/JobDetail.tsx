"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { inputClass, labelClass } from "./AddressFields";
import type { JobState } from "@/app/admin/jobs/actions";
import { formatMoney, formatQuantity, lineTotalCents } from "@/lib/crm/money";
import { JOB_STATUS_LABEL, type DocumentLine, type JobStatus, type Visit } from "@/lib/crm/opsTypes";

/**
 * Job detail: status, the visits on the calendar, and the button that turns
 * finished work into an invoice.
 *
 * The visit list is the operational heart of this screen. A renovation is
 * rarely one trip — assessment, demolition, drying, finishing — and the gaps
 * between them are what the schedule has to show, so each is its own row with
 * its own completion tick.
 */

export default function JobDetail({
  jobId,
  status,
  visits,
  lines,
  totals,
  hasInvoice,
  statusAction,
  addVisitAction,
  completeVisitAction,
  removeVisitAction,
  invoiceAction,
}: {
  jobId: string;
  status: JobStatus;
  visits: Visit[];
  lines: DocumentLine[];
  totals: { subtotal: number; discount: number; taxes: { name: string; cents: number }[]; total: number };
  hasInvoice: boolean;
  statusAction: (id: string, status: string) => Promise<void>;
  addVisitAction: (prev: JobState, formData: FormData) => Promise<JobState>;
  completeVisitAction: (visitId: string, completed: boolean) => Promise<void>;
  removeVisitAction: (visitId: string) => Promise<void>;
  invoiceAction: (depositPercent?: number) => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [visitState, runAddVisit, addingVisit] = useActionState(addVisitAction, {} as JobState);

  function run(fn: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  const nextStatuses: JobStatus[] = (
    {
      unscheduled: ["scheduled", "cancelled"],
      scheduled: ["in_progress", "complete", "cancelled"],
      in_progress: ["complete", "cancelled"],
      complete: ["in_progress"],
      cancelled: ["unscheduled"],
    } as Record<JobStatus, JobStatus[]>
  )[status];

  return (
    <div className="space-y-4">
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700"
        >
          {error}
        </p>
      )}

      <section className="rounded-xl border border-black/5 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="font-heading text-sm font-bold text-charcoal">Move this job along</h2>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {nextStatuses.map((next) => (
            <button
              key={next}
              type="button"
              onClick={() => run(() => statusAction(jobId, next))}
              disabled={pending}
              className="cursor-pointer rounded-lg border border-black/10 px-3 py-1.5 text-sm font-bold text-charcoal transition-colors hover:bg-black/[0.03] disabled:opacity-50"
            >
              {JOB_STATUS_LABEL[next]}
            </button>
          ))}

          {/* Invoicing is offered once the work is real. Billing an
              unscheduled job is possible but almost always a mistake, so it
              isn't put a tap away. */}
          {(status === "complete" || status === "in_progress") && !hasInvoice && (
            <button
              type="button"
              onClick={() => run(() => invoiceAction())}
              disabled={pending}
              className="cursor-pointer rounded-lg bg-brand-blue px-4 py-1.5 text-sm font-bold text-white transition-colors hover:bg-brand-blue/90 disabled:opacity-50"
            >
              Create invoice
            </button>
          )}

          {status !== "complete" && status !== "cancelled" && !hasInvoice && (
            <button
              type="button"
              onClick={() => run(() => invoiceAction(50))}
              disabled={pending}
              className="cursor-pointer rounded-lg border border-brand-blue/30 px-3 py-1.5 text-sm font-bold text-brand-blue transition-colors hover:bg-brand-blue/[0.04] disabled:opacity-50"
            >
              50% deposit invoice
            </button>
          )}
        </div>
      </section>

      {/* Visits ------------------------------------------------------- */}
      <section className="rounded-xl border border-black/5 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-sm font-bold text-charcoal">Visits</h2>
          {!adding && (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="cursor-pointer text-xs font-bold text-brand-blue transition-colors hover:text-brand-blue/70"
            >
              + Schedule a visit
            </button>
          )}
        </div>

        {visits.length === 0 && !adding && (
          <p className="mt-3 text-sm text-charcoal/40">
            Nothing booked. A job with no visit never appears on the schedule.
          </p>
        )}

        <ul className="mt-3 space-y-2">
          {visits.map((visit) => (
            <li
              key={visit.id}
              className={`flex items-start gap-3 rounded-lg border p-3 ${
                visit.completed_at ? "border-black/5 bg-black/[0.015]" : "border-black/10"
              }`}
            >
              <button
                type="button"
                onClick={() => run(() => completeVisitAction(visit.id, !visit.completed_at))}
                aria-label={visit.completed_at ? "Mark not done" : "Mark done"}
                className={`mt-0.5 flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 transition-colors ${
                  visit.completed_at
                    ? "border-brand-green bg-brand-green text-white"
                    : "border-black/20 hover:border-brand-green"
                }`}
              >
                {visit.completed_at && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>

              <div className="min-w-0 flex-1">
                <span
                  className={`block text-sm font-semibold ${
                    visit.completed_at ? "text-charcoal/45 line-through" : "text-charcoal"
                  }`}
                >
                  {visit.title || "Site visit"}
                </span>
                <span className="block text-xs text-charcoal/55">{formatVisit(visit)}</span>
                {visit.notes && (
                  <span className="mt-0.5 block text-xs text-charcoal/50">{visit.notes}</span>
                )}
              </div>

              <button
                type="button"
                onClick={() => run(() => removeVisitAction(visit.id))}
                aria-label="Remove visit"
                className="shrink-0 cursor-pointer rounded-md px-2 py-1 text-xs font-bold text-charcoal/35 transition-colors hover:bg-red-50 hover:text-red-600"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>

        {adding && (
          <form
            action={runAddVisit}
            onSubmit={() => setTimeout(() => setAdding(false), 400)}
            className="mt-3 space-y-3 rounded-lg border border-brand-blue/20 bg-brand-blue/[0.02] p-3"
          >
            {visitState.error && (
              <p role="alert" className="text-sm font-medium text-red-700">
                {visitState.error}
              </p>
            )}
            <div>
              <label className={labelClass}>What</label>
              <input name="title" placeholder="Demolition, drying check, finishing" className={inputClass} />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className={labelClass}>Date</label>
                <input type="date" name="date" required className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Start</label>
                <input type="time" name="time" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>End</label>
                <input type="time" name="endTime" className={inputClass} />
              </div>
            </div>
            <p className="text-[11px] text-charcoal/45">
              Leave the times blank for an all-day visit.
            </p>
            <div>
              <label className={labelClass}>Notes</label>
              <input name="notes" className={inputClass} />
            </div>
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={addingVisit}
                className="cursor-pointer rounded-lg bg-brand-blue px-3 py-1.5 text-sm font-bold text-white transition-colors hover:bg-brand-blue/90 disabled:opacity-60"
              >
                {addingVisit ? "Scheduling…" : "Schedule"}
              </button>
              <button
                type="button"
                onClick={() => setAdding(false)}
                className="cursor-pointer text-sm font-semibold text-charcoal/50 hover:text-charcoal"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </section>

      {/* Work ---------------------------------------------------------- */}
      <section className="overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
        <h2 className="border-b border-black/5 px-4 py-3 font-heading text-sm font-bold text-charcoal">
          Work
        </h2>
        <ul className="divide-y divide-black/5">
          {lines.map((line) =>
            line.kind === "text" ? (
              <li key={line.id} className="bg-black/[0.015] px-4 py-3">
                <p className="text-sm font-semibold text-charcoal/70">{line.name}</p>
                {line.description && (
                  <p className="mt-0.5 whitespace-pre-wrap text-xs leading-relaxed text-charcoal/55">
                    {line.description}
                  </p>
                )}
              </li>
            ) : (
              <li key={line.id} className="flex items-start gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-semibold text-charcoal">{line.name}</span>
                  {line.description && (
                    <p className="mt-0.5 text-xs leading-relaxed text-charcoal/55">
                      {line.description}
                    </p>
                  )}
                  <p className="mt-0.5 text-xs tabular-nums text-charcoal/45">
                    {formatQuantity(line.quantity_milli ?? 0)}
                    {line.unit ? ` ${line.unit}` : ""} × {formatMoney(line.unit_price_cents ?? 0)}
                    {line.labor_hours ? ` · ${line.labor_hours} h/unit` : ""}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-bold tabular-nums text-charcoal">
                  {formatMoney(
                    lineTotalCents({
                      quantityMilli: line.quantity_milli ?? 0,
                      unitPriceCents: line.unit_price_cents ?? 0,
                    }),
                  )}
                </span>
              </li>
            ),
          )}
        </ul>

        <dl className="space-y-1 border-t border-black/5 bg-black/[0.015] px-4 py-3 text-sm">
          <Row label="Subtotal" value={formatMoney(totals.subtotal)} />
          {totals.discount > 0 && (
            <Row label="Discount" value={`-${formatMoney(totals.discount)}`} muted />
          )}
          {totals.taxes.map((tax) => (
            <Row key={tax.name} label={tax.name} value={formatMoney(tax.cents)} muted />
          ))}
          <div className="border-t border-black/10 pt-1">
            <Row label="Total" value={formatMoney(totals.total)} bold />
          </div>
        </dl>
      </section>

      {hasInvoice && (
        <Link
          href="/admin/invoices"
          className="block rounded-xl border border-black/5 bg-white px-4 py-3 text-sm font-semibold text-brand-blue shadow-sm transition-colors hover:bg-black/[0.02]"
        >
          This job has been invoiced — view invoices →
        </Link>
      )}
    </div>
  );
}

/** "Tue 12 Aug · 08:00–12:00", or "Tue 12 Aug · all day". */
function formatVisit(visit: Visit): string {
  const start = new Date(visit.starts_at);
  const date = start.toLocaleDateString("en-CA", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "America/Toronto",
  });
  if (visit.all_day) return `${date} · all day`;

  const time = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-CA", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "America/Toronto",
    });

  return visit.ends_at
    ? `${date} · ${time(visit.starts_at)}–${time(visit.ends_at)}`
    : `${date} · ${time(visit.starts_at)}`;
}

function Row({
  label,
  value,
  bold,
  muted,
}: {
  label: string;
  value: string;
  bold?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={bold ? "font-bold text-charcoal" : muted ? "text-charcoal/55" : "text-charcoal/75"}>
        {label}
      </dt>
      <dd
        className={`tabular-nums ${
          bold ? "font-heading text-lg font-bold text-charcoal" : muted ? "text-charcoal/70" : "text-charcoal"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
