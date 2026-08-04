"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";

/**
 * The client half of AnaWidget — everything that needs the browser: the
 * IntersectionObserver that hides the bubble while /estimation's own inline
 * calculator is on screen, and the widget tag + loader script themselves.
 *
 * The widget renders its own floating bubble — nothing here builds a
 * launcher. `id="ana-widget"` exists so ChatProvider's openChat() can reach
 * this exact element for the pages that still trigger the conversation from
 * their own CTA button rather than the bubble (see ChatProvider.tsx for why
 * that means setting `always-expanded` rather than calling a method — this
 * widget version has none).
 *
 * `dynamic-variables` carries two things to the Custom LLM endpoint on every
 * turn: `channel: "web"`, which is what lets this conversation reach the
 * pricing tool a real phone call never gets (see extractWebChannel in
 * src/app/api/voice/el/chat/route.ts), and `site_locale`, so a visitor on the
 * French pages is greeted in the language they're already reading rather
 * than the widget's own fixed default.
 *
 * agent-id is not a secret — ElevenLabs' widget is designed to be embedded
 * publicly, and it is the same id every real inbound call already reaches.
 */
export default function AnaWidgetClient({
  agentId,
  locale,
}: {
  agentId: string;
  locale: "fr" | "en";
}) {
  const pathname = usePathname();
  const [suppressed, setSuppressed] = useState(false);

  // Reset on navigation during render rather than in the effect below —
  // React's documented way to adjust state when an input changes. Resetting
  // in the effect's cleanup instead also fires on unmount, and resetting
  // unconditionally in the effect body itself is a synchronous setState on
  // every run, which is exactly what the old FloatingChat this replaces hit
  // the same wall on.
  const [suppressedPathname, setSuppressedPathname] = useState(pathname);
  if (suppressedPathname !== pathname) {
    setSuppressedPathname(pathname);
    setSuppressed(false);
  }

  useEffect(() => {
    const cta = document.querySelector("[data-estimate-cta]");
    if (!cta) return;
    const observer = new IntersectionObserver(
      (entries) => setSuppressed(entries[entries.length - 1].isIntersecting),
      // A sliver counts as present; this isn't a reading target.
      { threshold: 0.01 },
    );
    observer.observe(cta);
    return () => observer.disconnect();
  }, [pathname]);

  return (
    <>
      <elevenlabs-convai
        id="ana-widget"
        agent-id={agentId}
        dynamic-variables={JSON.stringify({ channel: "web", site_locale: locale })}
        // Set for completeness, but verified live that it does NOT change the
        // pre-connect button chrome ("Démarrer un appel" / "Start a call") —
        // neither as an initial attribute nor mutated after mount. That text
        // is fixed by the shared agent's own default-language setting in
        // ElevenLabs (the same one Ana's dashboard agent has set to English —
        // see admin/ana/page.tsx), which this agent can't be flipped to
        // either language without breaking it for the other, since it also
        // answers real phone calls. What `site_locale` above DOES reliably
        // control is the language of what Ana actually says once the
        // conversation starts — that is decided by our own backend
        // (extractSiteLocaleHint in the Custom LLM route), not the widget.
        language={locale}
        style={suppressed ? { display: "none" } : undefined}
      />
      <Script
        src="https://unpkg.com/@elevenlabs/convai-widget-embed"
        strategy="afterInteractive"
        async
      />
    </>
  );
}
