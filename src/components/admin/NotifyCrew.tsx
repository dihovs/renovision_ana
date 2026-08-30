"use client";

import { useActionState, useState } from "react";
import type { DispatchState } from "@/app/(internal)/admin/jobs/actions";

export type CrewCandidate = {
  id: string;
  name: string;
  role: string;
  /** Null when they never agreed to be messaged — the send will refuse. */
  optedInAt: string | null;
};

export type DispatchHistoryRow = {
  id: string;
  name: string;
  kind: "scheduled" | "schedule_changed";
  channel: "whatsapp" | "sms";
  sentAt: string;
  state: "sent" | "delivered" | "read" | "failed";
  detail: string | null;
};

/**
 * "Notify crew" — the doorbell.
 *
 * Collapsed until asked for, because most visits to a job page are not a
 * dispatch, and an always-open list of everybody's names with a Send button on
 * it is a mis-tap that buzzes three phones.
 *
 * Nobody is pre-ticked. The obvious convenience — tick everyone who has ever
 * done work for us — is how a plumber learns about a job he is not on.
 */
export default function NotifyCrew({
  candidates,
  history,
  action,
  crewUrl,
}: {
  candidates: CrewCandidate[];
  history: DispatchHistoryRow[];
  action: (prev: DispatchState, formData: FormData) => Promise<DispatchState>;
  /** The existing crew link, when one has been minted. Shown so it can be copied. */
  crewUrl: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [state, submit, pending] = useActionState(action, {});

  return (
    <section className="rounded-xl border border-black/5 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-heading text-sm font-bold text-charcoal">Crew</h2>
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="cursor-pointer rounded-lg border border-black/10 px-3 py-1.5 text-xs font-bold text-charcoal transition-colors hover:bg-black/[0.03]"
          >
            Notify crew
          </button>
        )}
      </div>

      {history.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {history.map((row) => (
            <li key={row.id} className="flex items-baseline justify-between gap-3 text-xs">
              <span className="text-charcoal/75">
                <span className="font-medium text-charcoal">{row.name}</span>
                {" · "}
                {row.kind === "scheduled" ? "booked" : "time changed"}
                {row.channel === "sms" ? " · by text" : ""}
              </span>
              <span
                className={
                  row.state === "failed"
                    ? "shrink-0 font-bold text-red-600"
                    : row.state === "read"
                      ? "shrink-0 text-brand-green"
                      : "shrink-0 text-charcoal/45"
                }
                title={row.detail ?? undefined}
              >
                {label(row)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <form action={submit} className="mt-4 space-y-3 border-t border-black/5 pt-4">
          <fieldset className="space-y-1.5">
            <legend className="text-xs font-bold uppercase tracking-wide text-charcoal/45">
              Who
            </legend>
            {candidates.length === 0 && (
              <p className="text-xs text-charcoal/50">
                Nobody in the WhatsApp contacts yet. Add them from the inbox once they have
                messaged, or in the database with a role of subcontractor.
              </p>
            )}
            {candidates.map((candidate) => (
              <label
                key={candidate.id}
                className="flex items-center gap-2 text-sm text-charcoal/80"
              >
                <input
                  type="checkbox"
                  name="contactId"
                  value={candidate.id}
                  disabled={!candidate.optedInAt}
                  className="size-4 accent-brand-blue"
                />
                <span className={candidate.optedInAt ? "" : "text-charcoal/40"}>
                  {candidate.name}
                  {!candidate.optedInAt && " — never opted in"}
                </span>
              </label>
            ))}
          </fieldset>

          <div className="flex flex-wrap gap-2">
            <select
              name="kind"
              defaultValue="scheduled"
              className="rounded-lg border border-black/10 px-3 py-2 text-sm text-charcoal outline-none focus:border-charcoal/30"
            >
              <option value="scheduled">Job is booked</option>
              <option value="schedule_changed">The time has changed</option>
            </select>
            <select
              name="language"
              defaultValue="fr"
              className="rounded-lg border border-black/10 px-3 py-2 text-sm text-charcoal outline-none focus:border-charcoal/30"
            >
              <option value="fr">Français</option>
              <option value="en">English</option>
            </select>
            <button
              type="submit"
              disabled={pending}
              className="cursor-pointer rounded-lg bg-brand-blue px-4 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "Sending…" : "Send on WhatsApp"}
            </button>
          </div>

          <p className="text-[11px] leading-relaxed text-charcoal/45">
            They get the job number, the arrival window, the street and a link. The tasks, the
            access notes and the photos are behind the link — no prices, ever.
          </p>

          {state.error && <p className="text-xs font-bold text-red-600">{state.error}</p>}
          {state.ok && <p className="text-xs font-bold text-brand-green">{state.ok}</p>}
          {state.lines && state.lines.length > 0 && (
            <ul className="space-y-0.5 text-xs text-charcoal/60">
              {state.lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}
        </form>
      )}

      {crewUrl && (
        <p className="mt-3 break-all border-t border-black/5 pt-3 text-[11px] text-charcoal/40">
          Crew link: {crewUrl}
        </p>
      )}
    </section>
  );
}

function label(row: DispatchHistoryRow): string {
  if (row.state === "failed") return "failed";
  if (row.state === "read") return "read";
  if (row.state === "delivered") return "delivered";
  return "sent";
}
