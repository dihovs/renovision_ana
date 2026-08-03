"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { captureAttribution } from "@/lib/attribution";

type ChatContextValue = {
  isOpen: boolean;
  openChat: () => void;
  closeChat: () => void;
};

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  // Attribution capture lives here because this is the one client component
  // every page mounts through (root layout), so any landing page — /, a
  // service page, /estimation — records its campaign tag before the visitor
  // navigates and the referrer becomes ourselves. Runs after hydration only;
  // captureAttribution itself is a no-op on the server.
  useEffect(() => {
    captureAttribution();
  }, []);

  const value = useMemo(
    () => ({
      isOpen,
      openChat: () => setIsOpen(true),
      closeChat: () => setIsOpen(false),
    }),
    [isOpen],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return ctx;
}
