"use client";

import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useChat } from "@/components/chat/ChatProvider";
import LeadCaptureForm from "./LeadCaptureForm";
import { ChatMessage, ProjectSize, ProjectType, QualityTier } from "./chatLogic";

let idCounter = 0;
const nextId = () => `msg-${++idCounter}`;

type Selections = {
  type?: ProjectType;
  size?: ProjectSize;
  tier?: QualityTier;
};

type UiStep = "chat" | "leadCapture" | "done";

type ChatStreamEvent =
  | { type: "text"; text: string }
  | { type: "estimate"; projectType: ProjectType; size: ProjectSize; tier: QualityTier; low: string; high: string }
  | { type: "error"; message: string }
  | { type: "done" };

async function streamChat(
  history: { role: "user" | "assistant"; content: string; imageDataUrl?: string }[],
  locale: "en" | "fr",
  onEvent: (event: ChatStreamEvent) => void,
) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: history, locale }),
  });

  if (!res.ok || !res.body) {
    onEvent({ type: "error", message: "Request failed" });
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newlineIndex;
    while ((newlineIndex = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      if (!line) continue;
      onEvent(JSON.parse(line) as ChatStreamEvent);
    }
  }
}

export default function ChatWidget() {
  const { t, locale } = useLanguage();
  const { isOpen, openChat, closeChat } = useChat();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [step, setStep] = useState<UiStep>("chat");
  const [selections, setSelections] = useState<Selections>({});
  const [inputValue, setInputValue] = useState("");
  const [leadSubmitted, setLeadSubmitted] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const listEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [launcherVisible, setLauncherVisible] = useState(false);

  // Delay the launcher's entrance instead of showing it immediately on load —
  // a beat of stillness first, then it animates in, reads more intentional
  // than a chat bubble slamming onto the screen the instant the page paints.
  useEffect(() => {
    const timer = setTimeout(() => setLauncherVisible(true), 2500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, step]);

  // Lock the background page while the chat is open, full-screen on mobile.
  // Without this, iOS Safari lets the page behind a fixed overlay scroll
  // independently, which can shove the overlay's own content out of the
  // visible area — reads as text randomly vanishing.
  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  function pushAssistant(content: string) {
    setMessages((prev) => [...prev, { id: nextId(), role: "assistant", content }]);
  }

  function pushError() {
    pushAssistant(
      locale === "fr"
        ? "Désolé, une erreur est survenue. Veuillez réessayer."
        : "Sorry, something went wrong. Please try again.",
    );
  }

  async function sendToAI(text: string, imageDataUrl?: string) {
    const userMessage: ChatMessage = { id: nextId(), role: "user", content: text, imageDataUrl };
    const history = [...messages, userMessage];
    setMessages(history);
    setIsSending(true);

    const assistantId = nextId();
    let assistantStarted = false;

    try {
      await streamChat(
        history.map((m) => ({ role: m.role, content: m.content, imageDataUrl: m.imageDataUrl })),
        locale,
        (event) => {
          if (event.type === "text") {
            if (!assistantStarted) {
              assistantStarted = true;
              setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: event.text }]);
            } else {
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + event.text } : m)),
              );
            }
          } else if (event.type === "estimate") {
            setSelections({ type: event.projectType, size: event.size, tier: event.tier });
            pushAssistant(`${t.chat.estimate.intro} ${event.low} – ${event.high}`);
            pushAssistant(t.chat.estimate.disclaimer);
            pushAssistant(t.chat.leadCapture.intro);
            setStep("leadCapture");
          } else if (event.type === "error") {
            pushError();
          }
        },
      );
    } catch (err) {
      console.error("[chat] stream failed:", err);
      pushError();
    } finally {
      setIsSending(false);
    }
  }

  function handlePhotoFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      sendToAI(t.chat.photoAttached, dataUrl);
    };
    reader.readAsDataURL(file);
  }

  function handleSend() {
    const text = inputValue.trim();
    if (!text || isSending) return;
    setInputValue("");
    sendToAI(text);
  }

  async function handleLeadSubmit(data: { name: string; phone: string; email: string }) {
    await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...data,
        projectType: selections.type,
        size: selections.size,
        tier: selections.tier,
      }),
    });
    pushAssistant(t.chat.leadCapture.success);
    setLeadSubmitted(true);
    setStep("done");
  }

  function handleSkipLead() {
    setStep("done");
  }

  return (
    <>
      {!isOpen && (
        <button
          type="button"
          onClick={openChat}
          aria-label={t.chat.launcherLabel}
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-brand-green px-5 py-3.5 text-sm font-bold text-white shadow-lg transition-all duration-500 ease-out hover:scale-105 hover:bg-brand-green-dark ${
            launcherVisible
              ? "translate-y-0 scale-100 cursor-pointer opacity-100"
              : "pointer-events-none translate-y-4 scale-75 opacity-0"
          }`}
        >
          <span>{t.chat.launcherLabel}</span>
        </button>
      )}

      {isOpen && (
        <div
          data-lenis-prevent
          className="fixed inset-0 z-50 flex h-dvh items-end justify-end sm:inset-auto sm:h-auto sm:bottom-5 sm:right-5"
        >
          <div className="flex h-full w-full flex-col bg-white shadow-2xl sm:h-[640px] sm:max-h-[85vh] sm:w-96 sm:rounded-2xl sm:border sm:border-black/10">
            <div
              className="relative overflow-hidden rounded-t-2xl px-4 py-3.5 text-white"
              style={{ background: "linear-gradient(135deg, #2B5C9E 0%, #1F4677 100%)" }}
            >
              {/* Whisper of Quebec blue/white depth — same restrained-gradient
                  technique used on the About page's service-area card, just
                  adapted for an already-blue surface: a soft white highlight
                  up top, a deeper blue undertone in the opposite corner. */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    "radial-gradient(70% 60% at 10% -10%, rgba(255,255,255,0.18), transparent 55%), radial-gradient(60% 70% at 100% 120%, rgba(0,61,165,0.4), transparent 60%)",
                }}
              />
              <div className="relative flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/images/vision-ai-mark.png" alt="" className="h-5 w-5 object-contain" />
                    </span>
                    <p className="font-heading text-sm font-bold">{t.chat.title}</p>
                  </div>
                  <p className="mt-0.5 text-xs text-white/75">{t.chat.subtitle}</p>
                </div>
                <button
                  type="button"
                  onClick={closeChat}
                  aria-label="Close chat"
                  className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-white/80 hover:bg-white/10 hover:text-white"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            </div>

            <p className="border-b border-black/5 bg-brand-blue-light/50 px-4 py-2 text-[11px] leading-snug text-charcoal/60">
              {t.chat.disclaimer}
            </p>

            <div
              className="flex-1 space-y-3 overflow-y-auto px-4 py-4"
              style={{ background: "linear-gradient(180deg, #FFFFFF 0%, #EAF1FB 100%)" }}
            >
              {/* Rendered live from the current translation instead of stored in
                  state, so it switches instantly if the site language changes —
                  even if the chat was opened (and this greeting shown) earlier
                  under a different language. It's also intentionally excluded
                  from `messages`, so it's never sent to Claude as fake history. */}
              <MessageBubble message={{ id: "welcome", role: "assistant", content: t.chat.welcome }} />

              {messages.map((m) => (
                <MessageBubble key={m.id} message={m} />
              ))}

              {step === "chat" && messages.length === 0 && !isSending && (
                <OptionRow
                  options={[
                    { value: "waterDamage", label: t.chat.projectType.waterDamage },
                    { value: "flooring", label: t.chat.projectType.flooring },
                    { value: "kitchenBath", label: t.chat.projectType.kitchenBath },
                    { value: "interior", label: t.chat.projectType.interior },
                    { value: "basements", label: t.chat.projectType.basements },
                    { value: "repairs", label: t.chat.projectType.repairs },
                  ]}
                  onSelect={(_, label) => sendToAI(label)}
                />
              )}

              <div ref={listEndRef} />
            </div>

            {step === "leadCapture" && !leadSubmitted ? (
              <LeadCaptureForm onSubmit={handleLeadSubmit} onSkip={handleSkipLead} />
            ) : (
              <div className="flex items-center gap-2 border-t border-black/10 p-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handlePhotoFile(file);
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSending}
                  aria-label={t.chat.uploadLabel}
                  className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-brand-blue hover:bg-brand-blue-light disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <PaperclipIcon />
                </button>
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSend();
                  }}
                  disabled={isSending}
                  placeholder={t.chat.placeholder}
                  className="flex-1 rounded-full border border-black/10 bg-black/[0.02] px-4 py-2 text-base outline-none focus:border-brand-blue disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={isSending}
                  aria-label={t.chat.send}
                  className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-brand-green text-white hover:bg-brand-green-dark disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <SendIcon />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex items-end gap-2 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/vision-ai-mark.png" alt="" className="h-4.5 w-4.5 object-contain" />
        </span>
      )}
      <div
        className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
          isUser
            ? "rounded-br-sm bg-brand-blue text-white"
            : "rounded-bl-sm bg-black/5 text-charcoal"
        }`}
      >
        {message.imageDataUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={message.imageDataUrl}
            alt="Uploaded project photo"
            className="mb-1.5 max-h-40 w-full rounded-lg object-cover"
          />
        )}
        {message.content}
      </div>
    </div>
  );
}

function OptionRow({
  options,
  onSelect,
}: {
  options: { value: string; label: string }[];
  onSelect: (value: string, label: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onSelect(opt.value, opt.label)}
          className="cursor-pointer rounded-full border border-brand-blue/30 bg-white px-3.5 py-1.5 text-xs font-bold text-brand-blue transition-colors hover:bg-brand-blue hover:text-white"
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}


function PaperclipIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path
        d="M17 8.5 9.5 16a3 3 0 1 1-4.2-4.2L13 4a2 2 0 1 1 2.8 2.8l-7.6 7.6a1 1 0 1 1-1.4-1.4l7-7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 11.5 21 3l-5.5 18-4-7.5-8.5-2Z" />
    </svg>
  );
}
