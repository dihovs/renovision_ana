import Script from "next/script";
import AskClaude from "@/components/admin/AskClaude";

/**
 * Talk to Ana, live, from inside the admin — voice or typed, no phone needed.
 *
 * This is the SAME agent that answers the business line, reached through
 * ElevenLabs' own embeddable widget rather than a phone call. Voice and text
 * are both native to that widget (see the Widget channel settings in the
 * ElevenLabs dashboard — "Chat (text-only) mode" and "Send text while on
 * call" are both on), so there is nothing custom to build for either input.
 *
 * WHY THIS GETS OWNER MODE WITHOUT THE SPOKEN PIN. The phone path exists
 * because a caller is, by default, a stranger — caller ID is spoofable and a
 * PIN can be overheard, so both are required together. Nothing about that
 * applies here: this page is server-rendered behind the same session check
 * every other /admin route already goes through
 * (src/app/(internal)/admin/layout.tsx calls isSignedIn() before anything on
 * this route tree renders), so by the time a browser ever sees the widget
 * tag below, it has already cleared a real login.
 *
 * WHAT ACTUALLY CARRIES THAT SIGNAL IS THE AGENT'S URL, NOT THIS PAGE. The
 * admin agent's ElevenLabs Server URL points at /api/voice/el/admin, and that
 * route is the one that turns owner mode on — see the comment in
 * src/app/api/voice/el/admin/chat/completions/route.ts for why the obvious
 * approach (a `dashboard_owner_session` dynamic variable on the tag below)
 * cannot work: ElevenLabs never forwards dynamic variables to a Custom LLM.
 * The attribute is still set because it shows up in ElevenLabs' own
 * conversation log, which is genuinely useful when reading transcripts back —
 * but nothing depends on it arriving.
 *
 * The tools available once that unlocks are the same read-only surface plus
 * capture_task the phone gets — see src/lib/voice/ownerTools.ts. A task
 * dictated or typed here lands in the exact same list as one dictated over
 * the phone.
 *
 * ITS OWN ELEVENLABS AGENT, not the phone's. The first version of this page
 * reused ELEVENLABS_OUTBOUND_AGENT_ID — the same agent the dialer uses to
 * call customers — and it showed: the widget opened with a French customer
 * greeting and talked to Artush like a lead being qualified, because that
 * agent's default first_message and language ARE the customer script. This
 * one is a duplicate of that agent (same Custom LLM connection, so it hits
 * this exact endpoint) with its own English, owner-appropriate greeting and
 * default language — cosmetic only, since which persona actually speaks is
 * still decided by extractDashboardSession() below, not by which agent asks.
 */

export const metadata = { robots: { index: false, follow: false } };

export default function TalkToAnaPage() {
  const agentId = process.env.ELEVENLABS_ADMIN_AGENT_ID;

  // NO EARLY RETURN ON A MISSING AGENT ID. The typed box below needs only
  // ANTHROPIC_API_KEY; the widget is the only thing ElevenLabs gates. Bailing
  // out here — as this page did until ANA-20 — would have hidden a working
  // assistant behind a voice credential it never touches.

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-lg font-bold text-charcoal">Ask Ana</h1>
        <p className="mt-1 max-w-2xl text-xs leading-relaxed text-charcoal/50">
          Type below, or click the bubble in the corner to talk. Either way she reads the CRM,
          the crew&apos;s WhatsApp threads and customers&apos; texts, finds what is slipping,
          prices from the book, and drafts estimates, invoices and email replies — as drafts,
          for you to send. Anything you tell her to write down lands on the same list as a note
          dictated over the phone.
        </p>
      </div>

      {/* TWO WAYS TO ASK THE SAME AGENT, and they are genuinely different tools
          rather than a duplicate. The widget below is the voice agent: talk to
          it hands-free, and it answers aloud. This box is typed, streams into
          the page, runs on the cheap model, and — because it asks for the
          screen surface — writes amounts as $1,240.00 where the voice path has
          to say them as words or be misread by a factor of a hundred.

          Both reach the same tools through ownerToolsFor(), so neither can do
          anything the other cannot. */}
      <AskClaude startOpen title="Ask Ana" />

      <div className="rounded-2xl border border-dashed border-black/10 bg-white px-4 py-6 text-center text-xs text-charcoal/45">
        {agentId ? (
          "Prefer to talk? The voice conversation opens in the floating widget at the bottom right."
        ) : (
          <>
            Typing is the only way in right now — set{" "}
            <code className="font-mono text-brand-blue">ELEVENLABS_ADMIN_AGENT_ID</code> to add the
            voice widget. Everything above works without it.
          </>
        )}
      </div>

      {/* agent-id is not a secret — ElevenLabs' widget is designed to be
          embedded publicly. dynamic-variables is annotation only: it reaches
          ElevenLabs' conversation log but never our endpoint. See above. */}
      {agentId && (
        <>
          <elevenlabs-convai
            agent-id={agentId}
            dynamic-variables={JSON.stringify({ dashboard_owner_session: "authenticated" })}
          />
          <Script
            src="https://unpkg.com/@elevenlabs/convai-widget-embed"
            strategy="afterInteractive"
            async
          />
        </>
      )}
    </div>
  );
}
