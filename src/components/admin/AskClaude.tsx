"use client";

import { useEffect, useRef, useState } from "react";
import { stripImageMetadata } from "@/lib/stripImageMetadata";

/**
 * The assistant panel: "Ask about this" on a record, "Ask Ana" without one.
 *
 * Collapsed by default. It is a tool for the moment before a phone call, not
 * something that should occupy the screen on every page load, and an always-open
 * chat box on a record page reads as clutter the rest of the time.
 */

type Attachment = { media_type: string; data: string; preview: string };
type Message = { role: "user" | "assistant"; content: string; images?: Attachment[] };

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

/** Three is what a person attaches to one question; a fourth is a gallery. */
const MAX_PHOTOS = 3;

const RECORD_SUGGESTIONS = [
  "Summarise this for me",
  "What should I ask on the call?",
  "What's still unconfirmed?",
  "Anything here look wrong?",
];

/**
 * With no record open the useful questions are the ones that reach across the
 * business — which is exactly what the tools added in ANA-20 are for.
 */
const GENERAL_SUGGESTIONS = [
  "What's slipping?",
  "What's on my list?",
  "What do we charge for laminate?",
  "Anything from the crew today?",
];

export default function AskClaude({
  subject,
  /** Open on mount, for the page where asking IS the page. */
  startOpen = false,
  title,
}: {
  /**
   * The record on screen, when there is one. Absent on /admin/ana, where the
   * box is the whole point rather than a panel on somebody's file — the tools
   * reach the CRM either way, so no record is a narrower question, not an
   * empty one.
   */
  subject?: { kind: "lead" | "job" | "client"; id: string };
  startOpen?: boolean;
  title?: string;
}) {
  const [open, setOpen] = useState(startOpen);
  // "Ask about this" only makes sense when a "this" is on screen.
  const heading = title ?? (subject ? "Ask about this" : "Ask Ana");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activity, setActivity] = useState<string | null>(null);
  const [photos, setPhotos] = useState<Attachment[]>([]);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  // Escalation is deliberate here: the owner can see the answer and judge it.
  // On a phone call the same switch will have to be detected automatically.
  const [escalate, setEscalate] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  /**
   * Photos in, stripped and downscaled before they ever leave the device.
   *
   * stripImageMetadata fails closed — a photo that cannot be re-encoded is
   * refused rather than sent as-is, because the fallback would be sending the
   * GPS coordinates of a customer's home that the re-encode exists to remove.
   */
  // A recorder still running when the panel closes would hold the microphone
  // open with nothing listening for its result.
  useEffect(() => {
    return () => {
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    };
  }, []);

  async function attachPhotos(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) {
      setError(`Three photos at a time.`);
      return;
    }
    const added: Attachment[] = [];
    for (const file of Array.from(files).slice(0, room)) {
      try {
        const dataUrl = await stripImageMetadata(file);
        added.push({
          media_type: "image/jpeg",
          data: dataUrl.slice("data:image/jpeg;base64,".length),
          preview: dataUrl,
        });
      } catch {
        setError("That photo could not be read. Try taking it again.");
      }
    }
    if (added.length) setPhotos((prev) => [...prev, ...added]);
  }

  /**
   * Dictate, then read it back before it is asked.
   *
   * The transcript lands in the box rather than being sent, which is the whole
   * point: "log eighteen percent" misheard as eighty is a drying log an
   * adjuster reads later, and a glance at the words costs a second.
   */
  async function toggleRecording() {
    if (recording) {
      recorderRef.current?.stop();
      return;
    }
    setError(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("No microphone — check the app's permissions.");
      return;
    }

    const chunks: Blob[] = [];
    const recorder = new MediaRecorder(stream);
    recorderRef.current = recorder;
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };
    recorder.onstop = async () => {
      // Release the mic immediately — a live indicator on a phone after the
      // note is finished reads as an app that is still listening.
      stream.getTracks().forEach((track) => track.stop());
      setRecording(false);
      if (!chunks.length) return;

      setTranscribing(true);
      try {
        const body = new FormData();
        body.append("audio", new Blob(chunks, { type: recorder.mimeType || "audio/webm" }));
        const res = await fetch("/api/admin/transcribe", { method: "POST", body });
        const json = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
        if (!res.ok || !json.text) {
          setError(json.error ?? "That did not transcribe.");
        } else {
          // Appended, not replaced: he may have typed half the question first.
          setInput((prev) => (prev ? `${prev.trim()} ${json.text}` : (json.text as string)));
        }
      } catch {
        setError("That did not transcribe.");
      } finally {
        setTranscribing(false);
      }
    };
    recorder.start();
    setRecording(true);
  }

  async function ask(question: string) {
    const trimmed = question.trim();
    // A photo on its own is a question — "what is this?" — so words are only
    // required when nothing is attached.
    if ((!trimmed && photos.length === 0) || streaming) return;

    setError(null);
    setInput("");
    const attached = photos;
    setPhotos([]);
    const history: Message[] = [
      ...messages,
      { role: "user", content: trimmed, ...(attached.length ? { images: attached } : {}) },
    ];
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
        body: JSON.stringify({
          subject,
          // `preview` is a data URL this browser renders thumbnails from; it
          // would double every photo's weight on the wire for nothing.
          messages: history.map(({ role, content, images }) => ({
            role,
            content,
            ...(images?.length
              ? { images: images.map(({ media_type, data }) => ({ media_type, data })) }
              : {}),
          })),
          escalate,
        }),
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
        {heading}
      </button>
    );
  }

  return (
    <section className="rounded-xl border border-black/5 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-black/5 px-4 py-3">
        <h2 className="font-heading text-sm font-bold text-charcoal">{heading}</h2>
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
            {(subject ? RECORD_SUGGESTIONS : GENERAL_SUGGESTIONS).map((suggestion) => (
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
            {message.images?.length ? (
              <span className="mb-1.5 flex flex-wrap gap-1.5">
                {message.images.map((image, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={i}
                    src={image.preview}
                    alt=""
                    className="h-16 w-16 rounded-lg object-cover"
                  />
                ))}
              </span>
            ) : null}
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
        className="border-t border-black/5 p-3"
      >
        {photos.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {photos.map((photo, index) => (
              <div key={index} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.preview} alt="" className="h-16 w-16 rounded-lg object-cover" />
                <button
                  type="button"
                  onClick={() => setPhotos((prev) => prev.filter((_, i) => i !== index))}
                  aria-label="Remove this photo"
                  className="absolute -top-1.5 -right-1.5 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full bg-charcoal text-xs font-bold text-white"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2">
          {/* capture="environment" opens the camera straight away on the phone,
              which is where this is used — standing in front of the damage. */}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="hidden"
            onChange={(e) => {
              void attachPhotos(e.target.files);
              e.target.value = "";
            }}
          />
          <IconButton
            label="Add a photo"
            onClick={() => fileRef.current?.click()}
            disabled={streaming || photos.length >= MAX_PHOTOS}
          >
            <path d="M3 7h3l2-3h8l2 3h3v13H3z" strokeLinejoin="round" />
            <circle cx="12" cy="13" r="4" />
          </IconButton>
          <IconButton
            label={recording ? "Stop recording" : "Dictate a question"}
            onClick={() => void toggleRecording()}
            disabled={streaming || transcribing}
            active={recording}
          >
            <rect x="9" y="3" width="6" height="11" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0M12 18v3" strokeLinecap="round" />
          </IconButton>

          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              recording
                ? "Listening…"
                : transcribing
                  ? "Writing it down…"
                  : subject
                    ? "Ask anything about this record"
                    : "Ask Ana anything"
            }
            disabled={recording || transcribing}
            className="min-w-0 flex-1 rounded-lg border border-black/10 px-3 py-2 text-sm outline-none transition-colors placeholder:text-charcoal/30 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15 disabled:bg-black/[0.02]"
          />
          <button
            type="submit"
            disabled={streaming || recording || transcribing || (!input.trim() && photos.length === 0)}
            className="cursor-pointer rounded-lg bg-brand-blue px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-brand-blue/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Ask
          </button>
        </div>
      </form>

      <p className="px-3 pb-3 text-[11px] leading-snug text-charcoal/40">
        Only you see this. Ana reads the CRM and your messages, and drafts — she never sends.
      </p>
    </section>
  );
}

/** A square icon button, sized for a thumb on a job site. */
function IconButton({
  label,
  onClick,
  disabled,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg border transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? "border-red-600 bg-red-600 text-white"
          : "border-black/10 text-charcoal/60 hover:bg-black/[0.03]"
      }`}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        {children}
      </svg>
    </button>
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
