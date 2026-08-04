"use client";

import { createContext, useContext, useEffect, useMemo } from "react";
import { captureAttribution } from "@/lib/attribution";

type ChatContextValue = {
  openChat: () => void;
};

const ChatContext = createContext<ChatContextValue | null>(null);

/**
 * openChat() used to flip local `isOpen` state that the old floating chat
 * bubble rendered against. That bubble is gone — Ana's ElevenLabs widget
 * (AnaWidget/AnaWidgetClient) owns its own floating UI now — so opening the
 * conversation from any of this site's other CTAs (the header, the hero, the
 * pre-footer band, service pages) means reaching into the widget element
 * directly. `id="ana-widget"` is set once, on the single instance the root
 * layout mounts.
 *
 * SETTING always-expanded, NOT CALLING A METHOD. This widget version has no
 * imperative open()/startConversation() — verified live in the browser
 * against the actual loaded element: no such method exists on it, only a
 * long list of reactive attributes. `always-expanded="true"` is the one that
 * pins the panel open, confirmed the same way (it turned the collapsed
 * bubble into the full message/call panel when set on a live element).
 */
function openChat() {
  document.getElementById("ana-widget")?.setAttribute("always-expanded", "true");
}

export function ChatProvider({ children }: { children: React.ReactNode }) {
  // Attribution capture lives here because this is the one client component
  // every page mounts through (root layout), so any landing page — /, a
  // service page, /estimation — records its campaign tag before the visitor
  // navigates and the referrer becomes ourselves. Runs after hydration only;
  // captureAttribution itself is a no-op on the server.
  useEffect(() => {
    captureAttribution();
  }, []);

  const value = useMemo(() => ({ openChat }), []);

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return ctx;
}
