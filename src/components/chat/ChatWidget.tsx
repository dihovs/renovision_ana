"use client";

import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useChat } from "@/components/chat/ChatProvider";
import LeadCaptureForm from "./LeadCaptureForm";
import {
  ChatMessage,
  ChatStep,
  ProjectSize,
  ProjectType,
  QualityTier,
  estimateRange,
  isOnTopic,
} from "./chatLogic";

let idCounter = 0;
const nextId = () => `msg-${++idCounter}`;

type Selections = {
  type?: ProjectType;
  size?: ProjectSize;
  tier?: QualityTier;
};

export default function ChatWidget() {
  const { t } = useLanguage();
  const { isOpen, openChat, closeChat } = useChat();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [step, setStep] = useState<ChatStep>("projectType");
  const [selections, setSelections] = useState<Selections>({});
  const [inputValue, setInputValue] = useState("");
  const [leadSubmitted, setLeadSubmitted] = useState(false);
  const listEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const seeded = useRef(false);

  useEffect(() => {
    if (isOpen && !seeded.current) {
      seeded.current = true;
      pushAssistant(t.chat.welcome);
      pushAssistant(t.chat.projectType.question);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, step]);

  function pushAssistant(content: string) {
    setMessages((prev) => [...prev, { id: nextId(), role: "assistant", content }]);
  }

  function pushUser(content: string, imageDataUrl?: string) {
    setMessages((prev) => [...prev, { id: nextId(), role: "user", content, imageDataUrl }]);
  }

  function goToEstimate(finalSelections: Selections) {
    if (!finalSelections.type || !finalSelections.size || !finalSelections.tier) return;
    const { low, high } = estimateRange(
      finalSelections.type,
      finalSelections.size,
      finalSelections.tier,
    );
    pushAssistant(`${t.chat.estimate.intro} ${low} – ${high}`);
    pushAssistant(t.chat.estimate.disclaimer);
    pushAssistant(t.chat.leadCapture.intro);
    setStep("leadCapture");
  }

  function handleProjectType(value: ProjectType, label: string) {
    pushUser(label);
    setSelections((s) => ({ ...s, type: value }));
    pushAssistant(t.chat.size.question);
    setStep("size");
  }

  function handleSize(value: ProjectSize, label: string) {
    pushUser(label);
    setSelections((s) => ({ ...s, size: value }));
    pushAssistant(t.chat.tier.question);
    setStep("tier");
  }

  function handleTier(value: QualityTier, label: string) {
    pushUser(label);
    const updated = { ...selections, tier: value };
    setSelections(updated);
    pushAssistant(t.chat.photo.question);
    setStep("photo");
  }

  function handleSkipPhoto() {
    pushUser(t.chat.skip);
    setStep("estimate");
    goToEstimate(selections);
  }

  function handlePhotoFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      pushUser(t.chat.photoAttached, dataUrl);
      if (step === "photo") {
        setStep("estimate");
        goToEstimate(selections);
      }
    };
    reader.readAsDataURL(file);
  }

  function tryFreeTextForStep(text: string): boolean {
    const lower = text.toLowerCase();

    if (step === "projectType") {
      if (/(kitchen|bath)/.test(lower)) {
        handleProjectType("kitchenBath", t.chat.projectType.kitchenBath);
        return true;
      }
      if (/(water|flood|leak|damage)/.test(lower)) {
        handleProjectType("waterDamage", t.chat.projectType.waterDamage);
        return true;
      }
      if (/(floor|tile|hardwood|vinyl)/.test(lower)) {
        handleProjectType("flooring", t.chat.projectType.flooring);
        return true;
      }
      if (/(basement)/.test(lower)) {
        handleProjectType("basements", t.chat.projectType.basements);
        return true;
      }
      if (/(repair|patch|touch.?up|color match|colour match)/.test(lower)) {
        handleProjectType("repairs", t.chat.projectType.repairs);
        return true;
      }
      if (/(renovat|remodel|room|interior)/.test(lower)) {
        handleProjectType("interior", t.chat.projectType.interior);
        return true;
      }
      return false;
    }
    if (step === "size") {
      if (/small|one room|single/.test(lower)) {
        handleSize("small", t.chat.size.small);
        return true;
      }
      if (/medium|few rooms|multiple/.test(lower)) {
        handleSize("medium", t.chat.size.medium);
        return true;
      }
      if (/large|whole|entire|floor/.test(lower)) {
        handleSize("large", t.chat.size.large);
        return true;
      }
      return false;
    }
    if (step === "tier") {
      if (/lux/.test(lower)) {
        handleTier("luxury", t.chat.tier.luxury);
        return true;
      }
      if (/premium|high.?end/.test(lower)) {
        handleTier("premium", t.chat.tier.premium);
        return true;
      }
      if (/standard|basic|budget/.test(lower)) {
        handleTier("standard", t.chat.tier.standard);
        return true;
      }
      return false;
    }
    return false;
  }

  function handleSend() {
    const text = inputValue.trim();
    if (!text) return;
    setInputValue("");

    if (step === "photo") {
      pushUser(text);
      setStep("estimate");
      goToEstimate(selections);
      return;
    }

    if (step === "projectType" || step === "size" || step === "tier") {
      const matched = tryFreeTextForStep(text);
      if (matched) return;

      if (!isOnTopic(text)) {
        pushUser(text);
        pushAssistant(t.chat.offTopic);
        return;
      }

      pushUser(text);
      const question =
        step === "projectType"
          ? t.chat.projectType.question
          : step === "size"
            ? t.chat.size.question
            : t.chat.tier.question;
      pushAssistant(question);
      return;
    }

    pushUser(text);
    if (!isOnTopic(text)) {
      pushAssistant(t.chat.offTopic);
    } else {
      pushAssistant(t.chat.leadCapture.intro);
    }
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
          className="fixed bottom-5 right-5 z-50 flex cursor-pointer items-center gap-2 rounded-full bg-brand-green px-5 py-3.5 text-sm font-bold text-white shadow-lg transition-transform hover:scale-105 hover:bg-brand-green-dark"
          aria-label={t.chat.launcherLabel}
        >
          <ChatIcon />
          <span className="hidden sm:inline">{t.chat.launcherLabel}</span>
        </button>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-end sm:inset-auto sm:bottom-5 sm:right-5">
          <div className="flex h-full w-full flex-col bg-white shadow-2xl sm:h-[640px] sm:max-h-[85vh] sm:w-96 sm:rounded-2xl sm:border sm:border-black/10">
            <div className="flex items-center justify-between rounded-t-2xl bg-brand-blue px-4 py-3.5 text-white">
              <div>
                <p className="font-heading text-sm font-bold">{t.chat.title}</p>
                <p className="text-xs text-white/75">{t.chat.subtitle}</p>
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

            <p className="border-b border-black/5 bg-brand-blue-light/50 px-4 py-2 text-[11px] leading-snug text-charcoal/60">
              {t.chat.disclaimer}
            </p>

            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {messages.map((m) => (
                <MessageBubble key={m.id} message={m} />
              ))}

              {step === "projectType" && (
                <OptionRow
                  options={[
                    { value: "waterDamage", label: t.chat.projectType.waterDamage },
                    { value: "flooring", label: t.chat.projectType.flooring },
                    { value: "kitchenBath", label: t.chat.projectType.kitchenBath },
                    { value: "interior", label: t.chat.projectType.interior },
                    { value: "basements", label: t.chat.projectType.basements },
                    { value: "repairs", label: t.chat.projectType.repairs },
                  ]}
                  onSelect={(v, label) => handleProjectType(v as ProjectType, label)}
                />
              )}
              {step === "size" && (
                <OptionRow
                  options={[
                    { value: "small", label: t.chat.size.small },
                    { value: "medium", label: t.chat.size.medium },
                    { value: "large", label: t.chat.size.large },
                  ]}
                  onSelect={(v, label) => handleSize(v as ProjectSize, label)}
                />
              )}
              {step === "tier" && (
                <OptionRow
                  options={[
                    { value: "standard", label: t.chat.tier.standard },
                    { value: "premium", label: t.chat.tier.premium },
                    { value: "luxury", label: t.chat.tier.luxury },
                  ]}
                  onSelect={(v, label) => handleTier(v as QualityTier, label)}
                />
              )}
              {step === "photo" && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="cursor-pointer rounded-full bg-brand-blue-light px-4 py-1.5 text-xs font-bold text-brand-blue hover:bg-brand-blue/20"
                  >
                    {t.chat.uploadLabel}
                  </button>
                  <button
                    type="button"
                    onClick={handleSkipPhoto}
                    className="cursor-pointer rounded-full bg-black/5 px-4 py-1.5 text-xs font-bold text-charcoal/60 hover:bg-black/10"
                  >
                    {t.chat.skip}
                  </button>
                </div>
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
                  aria-label={t.chat.uploadLabel}
                  className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-brand-blue hover:bg-brand-blue-light"
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
                  placeholder={t.chat.placeholder}
                  className="flex-1 rounded-full border border-black/10 bg-black/[0.02] px-4 py-2 text-sm outline-none focus:border-brand-blue"
                />
                <button
                  type="button"
                  onClick={handleSend}
                  aria-label={t.chat.send}
                  className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-brand-green text-white hover:bg-brand-green-dark"
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
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
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

function ChatIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path
        d="M21 11.5a8.4 8.4 0 0 1-8.9 8.4A9 9 0 0 1 8 19l-4 1 1.3-3.9A8.4 8.4 0 1 1 21 11.5Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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
