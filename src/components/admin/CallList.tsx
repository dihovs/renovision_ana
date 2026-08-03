"use client";

import { useState, useSyncExternalStore } from "react";
import AskClaude from "./AskClaude";
import ProjectBriefCard from "./ProjectBriefCard";
import type { StoredCall } from "@/lib/crm/calls";

/**
 * Call transcripts.
 *
 * The whole dialogue, both sides. The escalation marker is shown inline
 * because it is the most useful signal here: it marks the exact turn where the
 * fast model stopped landing, which is where the prompt needs work.
 */

const STATUS_STYLE: Record<StoredCall["status"], string> = {
  in_progress: "bg-brand-green text-white",
  completed: "bg-black/[0.05] text-charcoal/60",
  failed: "bg-red-100 text-red-800",
  abandoned: "bg-amber-100 text-amber-800",
};

const STATUS_LABEL: Record<StoredCall["status"], string> = {
  in_progress: "Live",
  completed: "Completed",
  failed: "Failed",
  abandoned: "No answer",
};

/** How /admin/tasks addresses one transcript: `#call-<call_sid>`. */
const HASH_PREFIX = "#call-";

function subscribeToHash(onChange: () => void): () => void {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

function readHash(): string {
  return window.location.hash;
}

export default function CallList({ calls }: { calls: StoredCall[] }) {
  /**
   * `undefined` means nothing has been clicked yet, so the URL decides which
   * transcript is open; a string or null means the owner has since taken over.
   * The two are distinct states — "he closed this one" must not fall back to
   * the hash and spring it open again.
   */
  const [picked, setPicked] = useState<string | null | undefined>(undefined);

  // A dictated task on /admin/tasks links here as `#call-<sid>`; landing on a
  // collapsed row would leave the owner hunting for the conversation he just
  // clicked through to read. Subscribed rather than read in an effect so the
  // server snapshot is "" and hydration matches.
  const hash = useSyncExternalStore(subscribeToHash, readHash, () => "");
  const linkedId = hash.startsWith(HASH_PREFIX)
    ? (calls.find((call) => call.call_sid === decodeURIComponent(hash.slice(HASH_PREFIX.length)))
        ?.id ?? null)
    : null;

  const openId = picked === undefined ? linkedId : picked;

  return (
    <ul className="space-y-3">
      {calls.map((call) => {
        const open = openId === call.id;
        const callerSaid = call.turns?.find((t) => t.role === "caller")?.text;

        return (
          <li
            key={call.id}
            // Link target for /admin/tasks. scroll-mt clears the sticky header,
            // which would otherwise cover the row the browser just jumped to.
            id={call.call_sid ? `call-${call.call_sid}` : undefined}
            className="scroll-mt-20 overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm"
          >
            <button
              type="button"
              onClick={() => setPicked(open ? null : call.id)}
              aria-expanded={open}
              className="flex w-full cursor-pointer items-start justify-between gap-3 p-4 text-left"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-heading text-base font-bold text-brand-blue">
                    {call.from_number || "Unknown number"}
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${STATUS_STYLE[call.status]}`}
                  >
                    {STATUS_LABEL[call.status]}
                  </span>
                  {call.escalated_at && (
                    <span
                      title={call.escalation_reason ?? undefined}
                      className="shrink-0 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-800"
                    >
                      Escalated
                    </span>
                  )}
                  <span className="shrink-0 rounded-full bg-black/[0.05] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-charcoal/50">
                    {call.locale}
                  </span>
                </div>
                <p className="mt-1 truncate text-sm text-charcoal/70">
                  {callerSaid || "Nothing was said"}
                </p>
                <p className="mt-1 text-xs text-charcoal/45">
                  {new Date(call.started_at).toLocaleString("en-CA", {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: "America/Toronto",
                  })}
                  {call.duration_seconds != null && ` · ${formatDuration(call.duration_seconds)}`}
                  {` · ${call.turns?.length ?? 0} turns`}
                </p>
              </div>
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden
                className={`mt-1 shrink-0 text-charcoal/40 transition-transform ${open ? "rotate-180" : ""}`}
              >
                <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {open && (
              <div className="border-t border-black/5 px-4 pb-4 pt-3">
                {call.from_number && (
                  <a
                    href={`tel:${call.from_number.replace(/[^\d+]/g, "")}`}
                    className="mb-4 block rounded-full bg-brand-green px-4 py-2.5 text-center text-sm font-bold uppercase tracking-[0.08em] text-white hover:bg-brand-green-dark"
                  >
                    Call {call.from_number} back
                  </a>
                )}

                {call.escalation_reason && (
                  <p className="mb-3 rounded-lg bg-violet-50 px-3 py-2 text-xs text-violet-900">
                    <strong className="font-bold">Escalated to the stronger model:</strong>{" "}
                    {call.escalation_reason}
                  </p>
                )}

                <div className="space-y-2">
                  {(call.turns ?? []).map((turn, index) => {
                    const turnTime = formatTurnTime(turn.at);
                    return (
                      <div
                        key={index}
                        className={
                          turn.role === "caller"
                            ? "max-w-[85%] rounded-2xl rounded-tl-sm bg-black/[0.04] px-3 py-2"
                            : "ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-brand-blue/[0.07] px-3 py-2"
                        }
                      >
                        <span className="mb-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] font-bold uppercase tracking-wide text-charcoal/40">
                          <span>{turn.role === "caller" ? "Caller" : "Ana"}</span>
                          {turn.escalated && (
                            <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-violet-800">
                              Escalated
                            </span>
                          )}
                          {turnTime && (
                            <span className="ml-auto font-mono text-[10px] font-semibold normal-case tracking-normal text-charcoal/30">
                              {turnTime}
                            </span>
                          )}
                        </span>
                        <span className="block text-sm leading-relaxed text-charcoal/85">
                          {turn.text}
                        </span>
                      </div>
                    );
                  })}
                  {(call.turns ?? []).length === 0 && (
                    <p className="text-sm text-charcoal/40">
                      Nothing was recorded — the caller hung up before speaking.
                    </p>
                  )}
                </div>

                {/* Written by the post-call extraction (lib/voice/postCallLead)
                    — the job sheet, so the owner doesn't re-read forty turns
                    to learn which room it was. */}
                {call.project_brief && <ProjectBriefCard brief={call.project_brief} />}

                {call.lead_id && (
                  <a
                    href={`/admin/leads#lead-${call.lead_id}`}
                    className="mt-3 inline-block text-sm font-bold text-brand-blue hover:underline"
                  >
                    Open this call&apos;s lead in the pipeline →
                  </a>
                )}

                <p className="mt-3 text-[11px] text-charcoal/40">
                  Text only. No audio of this call was recorded or stored.
                </p>

                {call.lead_id && (
                  <div className="mt-4">
                    <AskClaude subject={{ kind: "lead", id: call.lead_id }} />
                  </div>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return mins > 0 ? `${mins}m ${rest}s` : `${rest}s`;
}

/** "10:42:15 AM" for a turn, or "" if the call predates this field. */
function formatTurnTime(at: string | undefined): string {
  if (!at) return "";
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-CA", { timeStyle: "medium", timeZone: "America/Toronto" });
}
