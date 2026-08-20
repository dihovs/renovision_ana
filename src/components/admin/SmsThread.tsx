"use client";

import { useActionState, useEffect, useRef } from "react";
import type { SmsMessage } from "@/lib/sms/thread";

/**
 * The text conversation with one client, and the box to add to it.
 *
 * Reads as a thread rather than a log because that is what it is — the owner
 * is looking at what was said, not auditing a queue. Ours on the right, theirs
 * on the left, the way every messaging app on his phone already works.
 *
 * The composer disables entirely when the number has unsubscribed. That is a
 * deliberate dead end rather than a send that fails afterwards: the guarantee
 * lives in lib/sms/send.ts, but a button that looks live and then refuses
 * teaches him to distrust the panel, and this is the one place where the
 * refusal is a legal obligation rather than an error.
 */
export default function SmsThread({
  phone,
  messages,
  optedOut,
  action,
}: {
  phone: string;
  messages: SmsMessage[];
  optedOut: boolean;
  action: (prev: string | null, formData: FormData) => Promise<string | null>;
}) {
  const [error, submit, pending] = useActionState(action, null);
  const formRef = useRef<HTMLFormElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Clear the box only once a send has actually succeeded — on a failure the
  // words he typed are still the words he wants to send.
  useEffect(() => {
    if (!pending && !error) formRef.current?.reset();
  }, [pending, error]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length]);

  return (
    <section className="rounded-xl border border-black/5 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-heading text-sm font-bold text-charcoal">Text messages</h2>
        <span className="font-mono text-[11px] text-charcoal/40">{phone}</span>
      </div>

      {messages.length === 0 ? (
        <p className="mt-2 text-xs leading-relaxed text-charcoal/55">
          No texts yet. The first one you send introduces the company and explains how to opt out.
        </p>
      ) : (
        <div className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
          {messages.map((message) => {
            const ours = message.direction === "outbound";
            return (
              <div key={message.id} className={ours ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                    ours
                      ? "rounded-br-sm bg-charcoal text-white"
                      : "rounded-bl-sm bg-black/[0.05] text-charcoal"
                  }`}
                >
                  {message.body && <p className="whitespace-pre-wrap">{message.body}</p>}

                  {/* The photo a customer texts at 2am is frequently the
                      whole enquiry on this trade, so it is shown at a size
                      worth looking at rather than as an attachment chip. The
                      link opens the full one. */}
                  {message.media.length > 0 && (
                    <div
                      className={`grid gap-1.5 ${message.media.length > 1 ? "grid-cols-2" : "grid-cols-1"} ${message.body ? "mt-2" : ""}`}
                    >
                      {message.media.map((url) => (
                        <a key={url} href={url} target="_blank" rel="noreferrer">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={url}
                            alt="Sent with the message"
                            className="w-full rounded-lg object-cover"
                            style={{ maxHeight: message.media.length > 1 ? 120 : 220 }}
                          />
                        </a>
                      ))}
                    </div>
                  )}
                  <p
                    className={`mt-1 text-[10px] ${ours ? "text-white/45" : "text-charcoal/40"}`}
                  >
                    {new Date(message.createdAt).toLocaleString("en-CA", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                    {message.status === "failed" && (
                      <span className="ml-1 font-semibold text-red-300">
                        · not delivered{message.error ? ` (${message.error})` : ""}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>
      )}

      {optedOut ? (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
          This number replied STOP, so we can&rsquo;t text it. Only they can restart it, by texting
          START. You can still call.
        </p>
      ) : (
        <form ref={formRef} action={submit} className="mt-3">
          <textarea
            name="body"
            rows={2}
            maxLength={1200}
            placeholder="Write a message…"
            className="w-full resize-y rounded-lg border border-black/10 px-3 py-2 text-sm text-charcoal outline-none placeholder:text-charcoal/30 focus:border-charcoal/30"
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-[11px] leading-relaxed text-charcoal/45" aria-live="polite">
              {error ? <span className="font-medium text-red-600">{error}</span> : null}
            </p>
            <button
              type="submit"
              disabled={pending}
              className="shrink-0 cursor-pointer rounded-lg bg-charcoal px-4 py-2 text-xs font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? "Sending…" : "Send"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
