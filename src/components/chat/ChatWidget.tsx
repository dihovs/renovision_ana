"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useChat } from "@/components/chat/ChatProvider";
import LeadCaptureForm from "./LeadCaptureForm";
import HandymanCalculator, { type TripFeeOutcome } from "./HandymanCalculator";
import { ChatMessage } from "./chatLogic";
import { calculateHandymanEstimate, calculateTax, formatCents, formatCentsPrecise } from "@/lib/estimator/calculate";
import { stripImageMetadata } from "@/lib/stripImageMetadata";

type ChatTrack = "unset" | "handyman" | "renovation";

let idCounter = 0;
const nextId = () => `msg-${++idCounter}`;

type EstimateLine = {
  name: string;
  quantity: number;
  unit: string;
  total: string;
  laborHours: number;
};

type EstimateDetails = {
  scopeSummary: string;
  low: string;
  expected: string;
  high: string;
  lines: EstimateLine[];
  subtotal: string;
  gst: string;
  qst: string;
  total: string;
  totalLaborHours: number;
  estimatedWorkDays: number;
  exclusions: string[];
};

type UiStep = "chat" | "leadCapture" | "done";

type ChatStreamEvent =
  | { type: "text"; text: string }
  | ({ type: "estimate" } & EstimateDetails)
  | { type: "collectContact" }
  | { type: "error"; message: string }
  | { type: "done" };

async function streamChat(
  history: { role: "user" | "assistant"; content: string; imageDataUrl?: string }[],
  locale: "en" | "fr",
  track: "handyman" | "renovation",
  onEvent: (event: ChatStreamEvent) => void,
) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: history, locale, track }),
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
  const pathname = usePathname();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [step, setStep] = useState<UiStep>("chat");
  const [track, setTrack] = useState<ChatTrack>("unset");
  const [estimate, setEstimate] = useState<EstimateDetails | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [leadSubmitted, setLeadSubmitted] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const listEndRef = useRef<HTMLDivElement>(null);
  const calculatorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [launcherVisible, setLauncherVisible] = useState(false);

  // Delay the launcher's entrance instead of showing it immediately on load —
  // a beat of stillness first, then it animates in, reads more intentional
  // than a chat bubble slamming onto the screen the instant the page paints.
  useEffect(() => {
    const timer = setTimeout(() => setLauncherVisible(true), 2500);
    return () => clearTimeout(timer);
  }, []);

  // Suppress the floating launcher while a page's own estimate CTA is on
  // screen, so the identical call to action never appears twice at once. The
  // marker currently lives on the homepage hero button; pages without one show
  // the launcher normally.
  //
  // Keyed on `pathname` because ChatWidget is mounted in the root layout and
  // never remounts between marketing pages. With an empty dep array the
  // observer was wired once, to whatever existed at first load — so arriving on
  // /services and then navigating home left suppression permanently off and
  // both CTAs visible together.
  const [pageCtaOnScreen, setPageCtaOnScreen] = useState(false);
  useEffect(() => {
    const cta = document.querySelector("[data-estimate-cta]");
    if (!cta) {
      // Nothing to suppress against on this page. Reset via the cleanup path
      // rather than setting state during the effect body, which React flags as
      // a render-phase update.
      return () => setPageCtaOnScreen(false);
    }
    const observer = new IntersectionObserver(
      (entries) => {
        // Read the LAST record: the UA can queue several between passes, and
        // entries[0] is the oldest, which inverts the result.
        const latest = entries[entries.length - 1];
        setPageCtaOnScreen(latest.isIntersecting);
      },
      // A sliver counts as present; this isn't a reading target.
      { threshold: 0.01 },
    );
    observer.observe(cta);
    return () => observer.disconnect();
  }, [pathname]);

  // Scrolling to the very bottom is right for a stream of short bubbles, but
  // wrong when the tall calculator card is on screen — it pushes the card's
  // own heading and postal-code field above the visible area. When it's
  // showing, align to its top instead.
  useEffect(() => {
    const target = calculatorRef.current ?? listEndRef.current;
    target?.scrollIntoView({
      behavior: "smooth",
      block: calculatorRef.current ? "start" : "end",
    });
  }, [messages, step, track, estimate]);

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

  // Handyman is a UI-only branch (no AI round trip needed to pick it) — once
  // chosen, explain the flat-rate model and let the calculator below do the math.
  function handleSelectTrack(value: "handyman" | "renovation") {
    setTrack(value);
    if (value === "handyman") pushAssistant(t.chat.handyman.intro);
  }

  function handleHandymanCalculate(hours: number, tripFee: TripFeeOutcome) {
    const calc = calculateHandymanEstimate(hours);
    const lines: EstimateLine[] = [
      {
        name: t.chat.handyman.labourLabel,
        quantity: calc.billedHours,
        unit: "h",
        total: formatCentsPrecise(calc.labourCents),
        laborHours: calc.billedHours,
      },
    ];

    // Trip fee is taxable the same as labour, so it's folded into one
    // combined subtotal/tax rather than taxed twice separately.
    let taxableCents = calc.labourCents;
    if (tripFee && tripFee.cents > 0) {
      lines.push({
        name: tripFee.trafficMultiplier > 1 ? `${t.chat.handyman.tripFeeLabel} (${t.chat.handyman.tripFeeTrafficNote})` : t.chat.handyman.tripFeeLabel,
        quantity: tripFee.billableRoundTripKm,
        unit: "km",
        total: formatCentsPrecise(tripFee.cents),
        laborHours: 0,
      });
      taxableCents += tripFee.cents;
    }
    const tax = calculateTax(taxableCents);

    const scopeSummary =
      locale === "fr"
        ? `Travail de bricolage — environ ${calc.billedHours} h de main-d'œuvre (minimum de 2 h)${
            tripFee ? `, code postal ${tripFee.postalCode}` : ""
          }. Matériaux facturés séparément, au coût réel.`
        : `Handyman job — approx. ${calc.billedHours} hour(s) of labour (2-hour minimum applied)${
            tripFee ? `, postal code ${tripFee.postalCode}` : ""
          }. Materials billed separately, at cost.`;

    const details: EstimateDetails = {
      scopeSummary,
      low: formatCents(taxableCents),
      expected: formatCents(taxableCents),
      high: formatCents(taxableCents),
      lines,
      subtotal: formatCentsPrecise(taxableCents),
      gst: formatCentsPrecise(tax.gstCents),
      qst: formatCentsPrecise(tax.qstCents),
      total: formatCentsPrecise(tax.totalCents),
      totalLaborHours: calc.billedHours,
      estimatedWorkDays: 1,
      exclusions: [t.chat.handyman.materialsNote],
    };

    setEstimate(details);
    pushAssistant(`${t.chat.handyman.estimateIntro} ${formatCents(calc.labourCents)}`);
    if (tripFee && tripFee.cents > 0) {
      pushAssistant(`${t.chat.handyman.tripFeeLabel}: ${formatCents(tripFee.cents)}`);
    } else if (tripFee === null) {
      pushAssistant(t.chat.handyman.tripFeeNotConfigured);
    }
    pushAssistant(`${t.chat.handyman.estimatedTotalLabel}: ${formatCents(taxableCents)}`);
    pushAssistant(t.chat.handyman.materialsNote);
    pushAssistant(t.chat.handyman.describePrompt);
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
        track === "handyman" ? "handyman" : "renovation",
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
            const { type: _t, ...details } = event;
            void _t;
            setEstimate(details);
            pushAssistant(`${t.chat.estimate.intro} ${event.low} – ${event.high}`);
            pushAssistant(t.chat.estimate.disclaimer);
            pushAssistant(t.chat.leadCapture.questionsPrompt);
            // Keep the chat open so the customer can ask questions. The form is
            // opened later — either by the collect_contact tool once they're
            // ready, or by the manual "Leave my details" button.
          } else if (event.type === "collectContact") {
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

  async function handlePhotoFile(file: File) {
    // Re-encode before the photo goes anywhere. A phone photo carries the GPS
    // coordinates of the customer's home in its EXIF; this drops them on the
    // device rather than trusting the server to remove them later.
    try {
      const dataUrl = await stripImageMetadata(file);
      sendToAI(t.chat.photoAttached, dataUrl);
    } catch (err) {
      console.error("[chat] could not process photo:", err);
      pushAssistant(t.chat.photoFailed);
    }
  }

  function handleSend() {
    const text = inputValue.trim();
    if (!text || isSending) return;
    setInputValue("");
    sendToAI(text);
  }

  async function handleLeadSubmit(data: {
    name: string;
    phone: string;
    email: string;
    address?: string;
    marketingConsent: boolean;
    consent?: { grantedAt: string; wording: string; locale: string; source: string };
  }) {
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...data,
        locale,
        scopeSummary: estimate?.scopeSummary,
        customerNotes: messages
          .filter((m) => m.role === "user" && m.content && m.content !== t.chat.photoAttached)
          .map((m) => m.content)
          .join("\n"),
        // Photos were only ever sent to Claude to judge scope; they never
        // reached the owner, which defeats the point of asking for them.
        photos: messages.flatMap((m) => (m.role === "user" && m.imageDataUrl ? [m.imageDataUrl] : [])),
        estimateLow: estimate?.low,
        estimateHigh: estimate?.high,
        estimateExpected: estimate?.expected,
        lines: estimate?.lines,
        subtotal: estimate?.subtotal,
        gst: estimate?.gst,
        qst: estimate?.qst,
        total: estimate?.total,
        totalLaborHours: estimate?.totalLaborHours,
        estimatedWorkDays: estimate?.estimatedWorkDays,
        exclusions: estimate?.exclusions,
      }),
    });

    // Only claim success when the lead actually reached someone. Telling a
    // customer we'll be in touch when nothing was recorded is worse than
    // showing an error — they stop chasing and wait for a call that can't come.
    if (!res.ok) {
      pushAssistant(t.chat.leadCapture.failed);
      return;
    }

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
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full uppercase tracking-[0.08em] bg-brand-green px-5 py-3.5 text-sm font-bold text-white shadow-lg transition-all duration-500 ease-out hover:scale-105 hover:bg-brand-green-dark ${
            launcherVisible && !pageCtaOnScreen
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
          <div className="relative flex h-full w-full flex-col overflow-hidden bg-white shadow-2xl sm:h-[720px] sm:max-h-[88vh] sm:w-[26rem] sm:rounded-3xl sm:border sm:border-black/10">
            <div
              className="relative overflow-hidden px-5 pb-3 pt-4 text-white"
              style={{ background: "linear-gradient(135deg, #2B5C9E 0%, #1F4677 100%)" }}
            >
              {/* Whisper of Quebec blue/white depth — same restrained-gradient
                  technique used on the About page's service-area card. */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    "radial-gradient(70% 60% at 10% -10%, rgba(255,255,255,0.18), transparent 55%), radial-gradient(60% 70% at 100% 120%, rgba(0,61,165,0.4), transparent 60%)",
                }}
              />
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/images/vision-ai-mark.png" alt="" className="h-5 w-5 object-contain" />
                  </span>
                  <div>
                    <p className="font-heading text-sm font-bold">{t.chat.title}</p>
                    <span className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-green-soft" />
                      <span className="text-[11px] font-medium text-white/70">{t.chat.subtitle}</span>
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeChat}
                  aria-label="Close chat"
                  className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/15 hover:text-white"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            </div>

            <p className="border-b border-black/5 bg-brand-blue-light/50 px-5 py-2 text-[11px] leading-snug text-charcoal/60">
              {t.chat.disclaimer}
            </p>

            <div
              className="relative flex-1 space-y-3 overflow-y-auto px-4 py-4"
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

              {step === "chat" && track === "unset" && messages.length === 0 && !isSending && (
                <OptionRow
                  options={[
                    { value: "handyman", label: t.chat.track.handyman },
                    { value: "renovation", label: t.chat.track.renovation },
                  ]}
                  onSelect={(value) => handleSelectTrack(value as "handyman" | "renovation")}
                />
              )}

              {step === "chat" && track === "renovation" && messages.length === 0 && !isSending && (
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

              {step === "chat" && track === "handyman" && !estimate && (
                <div ref={calculatorRef} className="scroll-mt-2">
                  <HandymanCalculator onCalculate={handleHandymanCalculate} />
                </div>
              )}

              <div ref={listEndRef} />
            </div>

            {step === "leadCapture" && !leadSubmitted ? (
              <LeadCaptureForm onSubmit={handleLeadSubmit} onSkip={handleSkipLead} />
            ) : (
              <div className="relative border-t border-black/10 bg-white">
                {/* Once an estimate exists, offer the details form as an
                    explicit next step — but keep the chat input below it so the
                    customer can still ask questions first. */}
                {estimate && step === "chat" && !leadSubmitted && (
                  <button
                    type="button"
                    onClick={() => setStep("leadCapture")}
                    className="w-full cursor-pointer bg-brand-green px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-green-dark"
                  >
                    {t.chat.leadCapture.getDetails}
                  </button>
                )}
                {/* Persistent, model-independent nudge to attach a photo — shown
                    while gathering scope, before an estimate exists. */}
                {step === "chat" && !estimate && (
                  <p className="px-4 pt-2.5 text-[11px] leading-snug text-charcoal/50">
                    {t.chat.photoHint}
                  </p>
                )}
                <div className="flex items-center gap-2 p-3">
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
                  className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-brand-blue/60 transition-all hover:scale-105 hover:bg-brand-blue-light hover:text-brand-blue disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <PaperclipIcon />
                </button>
                {/* Deliberately NOT disabled while sending. Disabling a focused
                    input makes the browser blur it, and it doesn't regain focus
                    when re-enabled — which forced the user to click back into the
                    field after every reply. The send button and Enter handler
                    already guard against sending mid-stream, so the field can
                    stay active and keep focus (and let them pre-type). */}
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSend();
                  }}
                  placeholder={t.chat.placeholder}
                  className="flex-1 rounded-xl border border-black/10 bg-black/[0.02] px-4 py-2 text-base outline-none transition-colors placeholder:text-charcoal/40 focus:border-brand-blue focus:bg-white"
                />
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={isSending}
                  aria-label={t.chat.send}
                  className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-brand-green text-white shadow-lg transition-all hover:scale-110 hover:bg-brand-green-dark active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <SendIcon />
                </button>
                </div>
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
            : "rounded-bl-sm border border-black/5 bg-white text-charcoal shadow-sm"
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
