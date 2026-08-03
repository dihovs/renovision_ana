"use client";

import { useState, useTransition } from "react";
import { inputClass, labelClass } from "./AddressFields";
import type { OutreachResult } from "@/app/(internal)/admin/outreach/actions";
import { INTRO_CALL_BOUNDARY } from "@/lib/crm/adadConsent";
import type { ConsentRow } from "@/lib/crm/consentStore";

/**
 * Recording consent, and placing the one call it allows.
 *
 * The screen is deliberately shaped so that the compliant path is the easy one
 * and the non-compliant path is not available. There is no "call anyway", no
 * override, and no way to type a number straight into a dialer: the only
 * control that queues a call sits on a row that already has consent on file,
 * and pressing it asks the server again before anything is queued.
 *
 * The wording field is the part that matters and the part nobody wants to
 * fill in, so it is required and the label says why.
 */

const CHANNELS: Array<{ value: string; label: string; hint: string }> = [
  { value: "in_person", label: "In person", hint: "You asked, they said yes. Note where and when." },
  { value: "email", label: "Email", hint: "They replied in writing. Link the thread." },
  { value: "written", label: "Signed form", hint: "A form or contract clause they signed." },
  { value: "phone_recorded", label: "On a recorded call", hint: "Only if the recording is kept." },
  { value: "web_form", label: "Web form", hint: "A ticked box on a form they submitted." },
];

type Status = "live" | "expired" | "withdrawn" | "suppressed";

function statusOf(row: ConsentRow, doNotCall: Set<string>, now: string): Status {
  if (doNotCall.has(row.phone)) return "suppressed";
  if (row.withdrawn_at) return "withdrawn";
  if (row.expires_at && row.expires_at <= now) return "expired";
  return "live";
}

const STATUS_STYLE: Record<Status, { label: string; className: string }> = {
  live: { label: "Consent live", className: "bg-brand-green/15 text-brand-green-dark" },
  expired: { label: "Expired", className: "bg-amber-100 text-amber-800" },
  withdrawn: { label: "Withdrawn", className: "bg-charcoal/10 text-charcoal/60" },
  suppressed: { label: "Do not call", className: "bg-red-100 text-red-800" },
};

export default function OutreachManager({
  rows,
  doNotCall,
  now,
  recordConsent,
  withdraw,
  suppress,
  queueIntro,
}: {
  rows: ConsentRow[];
  doNotCall: string[];
  /** ISO instant from the server, so expiry reads the same on both sides. */
  now: string;
  recordConsent: (formData: FormData) => Promise<OutreachResult>;
  withdraw: (phone: string) => Promise<OutreachResult>;
  suppress: (phone: string, note?: string | null) => Promise<OutreachResult>;
  queueIntro: (input: {
    phone: string;
    contactName?: string | null;
    companyName?: string | null;
    consentReminder?: string | null;
    locale?: "fr" | "en";
  }) => Promise<OutreachResult>;
}) {
  const [result, setResult] = useState<OutreachResult | null>(null);
  const [busy, startTransition] = useTransition();
  const suppressed = new Set(doNotCall);

  function run(work: () => Promise<OutreachResult>) {
    setResult(null);
    startTransition(async () => {
      try {
        setResult(await work());
      } catch {
        setResult({ ok: false, message: "That did not go through. Try again." });
      }
    });
  }

  return (
    <div className="space-y-8">
      {result && (
        <p
          role="status"
          className={`rounded-lg px-4 py-3 text-sm leading-relaxed ${
            result.ok
              ? "bg-brand-green/10 text-brand-green-dark"
              : "bg-red-50 text-red-800"
          }`}
        >
          {result.message}
        </p>
      )}

      <section className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
        <h2 className="font-heading text-base font-bold text-charcoal">Record a consent</h2>
        <p className="mt-1 max-w-2xl text-xs leading-relaxed text-charcoal/55">
          Ana can only place an introductory call to a number that has agreed to receive one. Ask
          them yourself — in person, by email, on a call you record — and write down here what they
          agreed to. The record is tied to the number, not the person: a yes on a mobile is not a
          yes on the office line.
        </p>

        <form
          action={(formData) => run(() => recordConsent(formData))}
          className="mt-4 grid gap-4 sm:grid-cols-2"
        >
          <Field name="phone" label="Phone number" required placeholder="514 839 9702" />
          <Field name="contactName" label="Contact name" placeholder="Marie Tremblay" />
          <Field name="companyName" label="Company" placeholder="Gestion Ajax" />
          <div>
            <label className={labelClass} htmlFor="channel">
              How was it given? <span className="text-red-600">*</span>
            </label>
            <select id="channel" name="channel" required defaultValue="in_person" className={inputClass}>
              {CHANNELS.map((channel) => (
                <option key={channel.value} value={channel.value}>
                  {channel.label} — {channel.hint}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="wording">
              What they agreed to <span className="text-red-600">*</span>
            </label>
            <textarea
              id="wording"
              name="wording"
              required
              rows={3}
              placeholder="I asked whether we could have our automated assistant call this number once to introduce the company, and Marie said yes."
              className={inputClass}
            />
            <p className="mt-1 text-[11px] leading-relaxed text-charcoal/45">
              This sentence is the evidence. If the CRTC asks, we have thirty days to produce it,
              and the onus is on us to show the consent was real. Write what was actually said, not
              what a template says.
            </p>
          </div>

          <Field name="evidenceUrl" label="Link to the evidence" placeholder="Link to the email thread or signed form" />
          <Field name="evidenceNote" label="Or a note about it" placeholder="Agreed at the Laval site walkthrough, 12 Aug" />
          <Field name="recordedBy" label="Recorded by" placeholder="Artush" />
          <div>
            <label className={labelClass} htmlFor="expiresAt">
              Ends on (optional)
            </label>
            <input id="expiresAt" name="expiresAt" type="date" className={inputClass} />
            <p className="mt-1 text-[11px] leading-relaxed text-charcoal/45">
              Leave empty unless they put a limit on it. Consent does not expire on its own.
            </p>
          </div>

          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={busy}
              className="cursor-pointer rounded-md bg-brand-blue px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-blue/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Record consent
            </button>
          </div>
        </form>
      </section>

      <section>
        <h2 className="font-heading text-base font-bold text-charcoal">On file</h2>
        <p className="mt-1 max-w-2xl text-xs leading-relaxed text-charcoal/55">
          One introductory call per number, ever. If it goes well, the next call is yours to make.
        </p>

        {rows.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-black/10 px-4 py-8 text-center text-xs text-charcoal/45">
            Nothing recorded yet. Until a number is on this list, Ana will refuse to introduce us to
            it — which is the correct behaviour, not a bug.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {rows.map((row) => {
              const status = statusOf(row, suppressed, now);
              const style = STATUS_STYLE[status];
              return (
                <li
                  key={row.id}
                  className="rounded-xl border border-black/5 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
                    <span className="font-heading text-sm font-bold text-charcoal">
                      {row.contact_name || row.company_name || row.phone}
                    </span>
                    <span className="font-mono text-xs text-charcoal/50">{row.phone}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${style.className}`}
                    >
                      {style.label}
                    </span>
                  </div>

                  {row.company_name && row.contact_name && (
                    <p className="mt-0.5 text-xs text-charcoal/55">{row.company_name}</p>
                  )}

                  <p className="mt-2 border-l-2 border-black/10 pl-3 text-xs leading-relaxed text-charcoal/70">
                    {row.wording}
                  </p>

                  <p className="mt-2 text-[11px] text-charcoal/45">
                    {row.channel.replace(/_/g, " ")} · recorded{" "}
                    {new Date(row.created_at).toLocaleDateString("en-CA")}
                    {row.recorded_by ? ` by ${row.recorded_by}` : ""}
                    {row.expires_at ? ` · ends ${row.expires_at.slice(0, 10)}` : ""}
                    {row.evidence_note ? ` · ${row.evidence_note}` : ""}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {status === "live" && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          run(() =>
                            queueIntro({
                              phone: row.phone,
                              contactName: row.contact_name,
                              companyName: row.company_name,
                              consentReminder: consentReminderFor(row),
                            }),
                          )
                        }
                        className="cursor-pointer rounded-md bg-brand-green px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-brand-green-dark disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Queue the intro call
                      </button>
                    )}
                    {status !== "withdrawn" && status !== "suppressed" && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => run(() => withdraw(row.phone))}
                        className="cursor-pointer rounded-md border border-black/15 px-3 py-1.5 text-xs font-semibold text-charcoal/70 transition-colors hover:bg-black/[0.03] disabled:opacity-50"
                      >
                        Withdraw consent
                      </button>
                    )}
                    {status !== "suppressed" && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => run(() => suppress(row.phone, "asked not to be called"))}
                        className="cursor-pointer rounded-md border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50"
                      >
                        They asked us to stop
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-2xl bg-charcoal-dark p-5">
        <h2 className="font-heading text-base font-bold text-white">
          What Ana is allowed to say on one of these
        </h2>
        <ul className="mt-3 space-y-1.5">
          {INTRO_CALL_BOUNDARY.map((rule) => (
            <li key={rule} className="flex gap-2 text-xs leading-relaxed text-white/75">
              <span aria-hidden className="text-brand-green-soft">
                •
              </span>
              {rule}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11px] leading-relaxed text-white/45">
          These are enforced in the prompt, not just written here. The best outcome the call can
          produce is permission to email and a callback from you — it cannot book, price, or close
          anything.
        </p>
      </section>
    </div>
  );
}

/**
 * One clause Ana says out loud so the person can recognise the call as the
 * thing they agreed to.
 *
 * Built from the record rather than typed again, so it cannot describe a
 * consent that is not the one on file.
 */
function consentReminderFor(row: ConsentRow): string {
  const when = new Date(row.created_at).toLocaleDateString("fr-CA", {
    month: "long",
    day: "numeric",
  });
  if (row.channel === "in_person") return `Vous nous aviez dit qu'on pouvait vous appeler, le ${when}.`;
  if (row.channel === "email") return `Vous nous aviez donné votre accord par courriel, le ${when}.`;
  return `Vous nous aviez donné votre accord le ${when}.`;
}

function Field({
  name,
  label,
  placeholder,
  required,
}: {
  name: string;
  label: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className={labelClass} htmlFor={name}>
        {label} {required && <span className="text-red-600">*</span>}
      </label>
      <input
        id={name}
        name={name}
        required={required}
        placeholder={placeholder}
        className={inputClass}
      />
    </div>
  );
}
