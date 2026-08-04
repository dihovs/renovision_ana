import AnaWidgetClient from "./AnaWidgetClient";

/**
 * Ana, live on the public site — the same voice-and-text widget the admin
 * dashboard uses (src/app/(internal)/admin/ana/page.tsx), pointed at the
 * customer-facing agent instead. This replaces what used to be a text-only,
 * mock-response chat launcher: the estimating itself is real now too, via the
 * build_estimate tool wired up in src/lib/voice/webTools.ts and
 * src/lib/voice/agent.ts's webSystemPrompt() — same catalog and pricing math
 * the site's own text estimator (src/app/api/chat) uses, just spoken or typed
 * back by Ana instead of rendered as a breakdown card.
 *
 * A server component on purpose, exactly like admin/ana/page.tsx: the agent
 * id is read from process.env here rather than a NEXT_PUBLIC_ var, so it
 * never has to be duplicated into a second, publicly-inlined env var just to
 * reach a client component. It is still not a secret either way — see the
 * comment on the tag itself in AnaWidgetClient.
 *
 * ONE AGENT, REUSED. This is the same id ELEVENLABS_OUTBOUND_AGENT_ID already
 * names — the one every real phone call and outbound errand already reaches
 * — not the admin's separate "Ana - Owner Dashboard" agent. Its default
 * greeting and language are already right for a customer (French-led,
 * Quebec-appropriate), which the admin one deliberately is NOT (see the
 * comment in admin/ana/page.tsx for what happened when the admin widget
 * reused this same agent for the wrong audience). Which PERSONA actually
 * runs is decided server-side by extractWebChannel() in
 * src/app/api/voice/el/chat/route.ts, not by which ElevenLabs agent asks.
 */
export default function AnaWidget({ locale }: { locale: "fr" | "en" }) {
  const agentId = process.env.ELEVENLABS_OUTBOUND_AGENT_ID;
  if (!agentId) return null;

  return <AnaWidgetClient agentId={agentId} locale={locale} />;
}
