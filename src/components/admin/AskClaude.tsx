"use client";

import { useRef, useState } from "react";

/**
 * "Ask about this" — the assistant panel on a lead, job or client.
 *
 * Collapsed by default. It is a tool for the moment before a phone call, not
 * something that should occupy the screen on every page load, and an always-open
 * chat box on a record page reads as clutter the rest of the time.
 */

type Message = { role: "user" | "assistant"; content: string };

/**
 * What to say while a tool runs. (ANA-20)
 *
 * A box that sits silent while it reads six tables looks broken, and this is
 * also the only place the owner can see WHICH tools answered him — which
 * matters when the answer is about his money. Unknown names fall back to the
 * raw tool name rather than a vague "working": a tool nobody named here should
 * look unfamiliar, not be disguised.
 */
const TOOL_LABEL: Record<string, string> = {
  record_brief: "Reading the whole file",
  business_snapshot: "Checking the dashboard",
  recent_leads: "Looking at recent leads",
  schedule: "Reading the calendar",
  money_owed: "Checking receivables",
  search_messages: "Searching messages",
  job_conversation: "Reading the job thread",
  team_updates: "Checking what the crew sent",
  whats_slipping: "Looking for what has gone quiet",
  my_tasks: "Reading your list",
  complete_task: "Ticking it off",
  capture_task: "Writing it down",
  price_lookup: "Checking the price book",
  job_margin: "Adding up the job",
  moisture_readings: "Reading the drying log",
  log_moisture_reading: "Logging the reading",
  find_file: "Searching OneDrive",
  draft_estimate: "Drafting the estimate",
  draft_invoice: "Drafting the invoice",
  draft_reply: "Writing the draft reply",
  notify_crew: "Messaging the crew",
  queue_customer_call: "Queueing the call",
};

const SUGGESTIONS = [
  "Summarise this for me",
  "What should I ask on the call?",
  "What's still unconfirmed?",
  "Anything here look wrong?",
];

export default function AskClaude({
  subject,
}: {
  subject: { kind: "lead" | "job" | "client"; id: string };
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activity, setActivity] = useState<string | null>(null);
  // Escalation is deliberate here: the owner can see the answer and judge it.
  // On a phone call the same switch will have to be detected automatically.
  const [escalate, setEscalate] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function ask(question: string) {
    const trimmed = question.trim();
    if (!trimmed || streaming) return;

    setError(null);
    setInput("");
    const history: Message[] = [...messages, { role: "user", content: trimmed }];
    // The empty assistant turn is appended immediately so the streamed text has
    // somewhere to land, and the owner sees it start rather than a dead pause.
    setMessages([...history, { role: "assistant", content: "" }]);
    setStreaming(true);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/admin/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, messages: history, escalate }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Could not reach the assistant.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // NDJSON: the last line may be a partial object, so it stays in the
        // buffer until its newline arrives.
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          let event: { type: string; text?: string; message?: string; name?: string };
          try {
            event = JSON.parse(line);
          } catch {
            continue;
          }
          if (event.type === "tool" && event.name) {
            setActivity(TOOL_LABEL[event.name] ?? event.name);
          } else if (event.type === "text" && event.text) {
            // Words are arriving, so whatever it was doing is done.
            setActivity(null);
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last?.role === "assistant") {
                next[next.length - 1] = { ...last, content: last.content + event.text };
              }
              return next;
            });
          } else if (event.type === "error") {
            setError(event.message ?? "Something went wrong.");
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    } finally {
      setStreaming(false);
      setActivity(null);
      // Drop a stillborn assistant turn so the thread doesn't keep an empty
      // bubble where an answer should be.
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        return last?.role === "assistant" && !last.content ? prev.slice(0, -1) : prev;
      });
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full cursor-pointer items-center gap-2 rounded-xl border border-black/5 bg-white px-4 py-3 text-sm font-bold text-brand-blue shadow-sm transition-colors hover:bg-black/[0.02]"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M12 3a9 9 0 0 0-9 9c0 1.5.4 2.9 1 4.2L3 21l4.8-1a9 9 0 1 0 4.2-17z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Ask about this
      </button>
    );
  }

  return (
    <section className="rounded-xl border border-black/5 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-black/5 px-4 py-3">
        <h2 className="font-heading text-sm font-bold text-charcoal">Ask about this</h2>
        <div className="flex items-center gap-3">
          <label className="flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold text-charcoal/50">
            <input
              type="checkbox"
              checked={escalate}
              onChange={(e) => setEscalate(e.target.checked)}
              className="h-3.5 w-3.5 cursor-pointer accent-brand-blue"
            />
            Think harder
          </label>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="cursor-pointer text-charcoal/35 transition-colors hover:text-charcoal"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      <div className="max-h-96 space-y-3 overflow-y-auto px-4 py-3">
        {messages.length === 0 && (
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => ask(suggestion)}
                className="cursor-pointer rounded-full border border-black/10 px-3 py-1.5 text-xs font-semibold text-charcoal/70 transition-colors hover:border-brand-blue/30 hover:text-brand-blue"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

        {messages.map((message, index) => (
          <div
            key={index}
            className={
              message.role === "user"
                ? "ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-brand-blue px-3 py-2 text-sm text-white"
                : "max-w-[92%] text-sm leading-relaxed whitespace-pre-wrap text-charcoal/85"
            }
          >
            {message.content ||
              (streaming && index === messages.length - 1 ? (
                <span className="inline-flex items-center gap-2 py-1">
                  <span className="inline-flex gap-1" aria-label="Thinking">
                    <Dot delay="0ms" />
                    <Dot delay="150ms" />
                    <Dot delay="300ms" />
                  </span>
                  {/* Named, not a spinner: when the answer is about his money,
                      which tools were consulted is part of the answer. */}
                  {activity && (
                    <span className="text-xs text-charcoal/50" aria-live="polite">
                      {activity}…
                    </span>
                  )}
                </span>
              ) : null)}
          </div>
        ))}

        {error && (
          <p role="alert" className="text-sm font-medium text-red-700">
            {error}
          </p>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
        className="flex gap-2 border-t border-black/5 p-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask anything about this record"
          className="flex-1 rounded-lg border border-black/10 px-3 py-2 text-sm outline-none transition-colors placeholder:text-charcoal/30 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15"
        />
        <button
          type="submit"
          disabled={streaming || !input.trim()}
          className="cursor-pointer rounded-lg bg-brand-blue px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-brand-blue/90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Ask
        </button>
      </form>

      <p className="px-3 pb-3 text-[11px] leading-snug text-charcoal/40">
        Only you see this. It answers from this record alone and will tell you when
        something isn&apos;t in it.
      </p>
    </section>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="h-1.5 w-1.5 animate-bounce rounded-full bg-charcoal/30"
      style={{ animationDelay: delay }}
    />
  );
}
