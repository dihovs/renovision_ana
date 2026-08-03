"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useChat } from "@/components/chat/ChatProvider";
import ChatConversation, { type ChatVariant } from "./ChatConversation";

/**
 * Two shells around one conversation.
 *
 * "floating" is what the root layout mounts on every page: a launcher button
 * that fades in after a beat, and a fixed corner panel (full-screen on
 * phones). "inline" drops the same conversation into page flow for /estimation,
 * where the estimator is the reason the page exists and hiding it behind a
 * corner bubble would be backwards.
 *
 * The shells are separate components rather than one with conditionals so the
 * inline variant never touches ChatProvider — there is no open/close state to
 * subscribe to when the conversation is always open, and hooks can't be called
 * conditionally anyway.
 */
export default function ChatWidget({ variant = "floating" }: { variant?: ChatVariant }) {
  return variant === "inline" ? <InlineChat /> : <FloatingChat />;
}

function InlineChat() {
  return <ChatConversation variant="inline" />;
}

function FloatingChat() {
  const { t } = useLanguage();
  const { isOpen, openChat, closeChat } = useChat();
  const pathname = usePathname();
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
  // marker lives on the homepage hero button and on /estimation's inline
  // estimator; pages without one show the launcher normally.
  //
  // Keyed on `pathname` because ChatWidget is mounted in the root layout and
  // never remounts between marketing pages. With an empty dep array the
  // observer was wired once, to whatever existed at first load — so arriving on
  // /services and then navigating home left suppression permanently off and
  // both CTAs visible together.
  const [pageCtaOnScreen, setPageCtaOnScreen] = useState(false);

  // Reset on navigation during render, which is React's documented way to
  // adjust state when an input changes. Doing it in the effect's cleanup
  // instead — the obvious-looking spot — also runs on unmount, and setting
  // state there logs "Can't perform a React state update on a component that
  // hasn't mounted yet" on every page that has no CTA to watch.
  const [ctaPathname, setCtaPathname] = useState(pathname);
  if (ctaPathname !== pathname) {
    setCtaPathname(pathname);
    setPageCtaOnScreen(false);
  }

  useEffect(() => {
    const cta = document.querySelector("[data-estimate-cta]");
    if (!cta) return;

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
          <ChatConversation variant="floating" onClose={closeChat} />
        </div>
      )}
    </>
  );
}
