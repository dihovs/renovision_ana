"use client";

import { useState, useTransition } from "react";
import { inputClass } from "./AddressFields";
import type { WhatsAppContact, WhatsAppMessage } from "@/lib/whatsapp/store";

/**
 * The unfiled queue.
 *
 * A queue, not a chat app — the goal is to empty it. One select and one tap per
 * message, and the photo ends up on the job it belongs to. A filed message
 * disappears from the list immediately rather than waiting for a round trip,
 * because the whole interaction is worth about a second.
 */
export default function WhatsAppInbox({
  messages,
  mediaUrls,
  jobs,
  fileAction,
}: {
  messages: (WhatsAppMessage & { contact: WhatsAppContact | null })[];
  mediaUrls: Record<string, string>;
  jobs: { id: string; label: string }[];
  fileAction: (messageId: string, jobId: string) => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();
  const [filed, setFiled] = useState<Set<string>>(new Set());
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const remaining = messages.filter((m) => !filed.has(m.id));

  function file(messageId: string) {
    const jobId = choice[messageId];
    if (!jobId) {
      setError("Pick a job first.");
      return;
    }
    setError(null);
    // Optimistic: the row goes now. If the write fails it comes back with the
    // error, which is a better trade than a second of dead UI per message.
    setFiled((prev) => new Set(prev).add(messageId));
    startTransition(async () => {
      try {
        await fileAction(messageId, jobId);
      } catch (err) {
        setFiled((prev) => {
          const next = new Set(prev);
          next.delete(messageId);
          return next;
        });
        setError(err instanceof Error ? err.message : "Could not file that one.");
      }
    });
  }

  if (remaining.length === 0) {
    return (
      <p className="rounded-xl border border-black/5 bg-white p-6 text-center text-sm text-charcoal/50 shadow-sm">
        Inbox empty. Everything is filed.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-charcoal/55">
        {remaining.length} message{remaining.length === 1 ? "" : "s"} waiting to be filed. Tip:
        putting <span className="font-mono font-semibold">#1042</span> in a WhatsApp message files
        it automatically.
      </p>

      {error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      <ul className="space-y-3">
        {remaining.map((message) => {
          const url = message.media_path ? mediaUrls[message.media_path] : null;
          const who =
            message.contact?.display_name ||
            message.contact?.profile_name ||
            message.contact?.wa_id ||
            "Unknown";

          return (
            <li key={message.id} className="rounded-xl border border-black/5 bg-white p-4 shadow-sm">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-bold text-charcoal">{who}</span>
                <span className="shrink-0 text-xs text-charcoal/40">
                  {new Date(message.sent_at).toLocaleString("en-CA", {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: "America/Toronto",
                  })}
                </span>
              </div>

              {message.body && (
                <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-charcoal/80">
                  {message.body}
                </p>
              )}

              {url && message.media_mime?.startsWith("image/") && (
                <a href={url} target="_blank" rel="noreferrer" className="mt-2 block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt="From the subcontractor"
                    className="max-h-56 rounded-lg border border-black/10 object-cover"
                  />
                </a>
              )}

              {url && !message.media_mime?.startsWith("image/") && (
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block text-sm font-semibold text-brand-blue hover:underline"
                >
                  Open {message.kind}
                </a>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                <select
                  value={choice[message.id] ?? ""}
                  onChange={(e) =>
                    setChoice((prev) => ({ ...prev, [message.id]: e.target.value }))
                  }
                  aria-label="File against a job"
                  className={`${inputClass} min-w-[200px] flex-1`}
                >
                  <option value="">Which job?</option>
                  {jobs.map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => file(message.id)}
                  disabled={pending}
                  className="cursor-pointer rounded-lg bg-brand-blue px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-brand-blue/90 disabled:opacity-50"
                >
                  File
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
