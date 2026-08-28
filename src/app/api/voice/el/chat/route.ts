import crypto from "crypto";
import {
  appendTurns,
  callerTurns,
  endCall,
  markEscalated,
  setCallLocale,
  type CallTurn,
} from "@/lib/crm/calls";
import {
  fallbackLine,
  isOutboundKind,
  outboundClosingLine,
  hasSpokenOutboundDisclosure,
  outboundFallbackLine,
  outboundOpening,
  outboundReply,
  outboundSilenceLine,
  inboundFarewellLine,
  ownerFallbackLine,
  ownerReplyToStream,
  replyToStream,
  wrongNumberLine,
  type AgentReply,
  type OutboundKind,
  type OutboundPayload,
} from "@/lib/voice/agent";
import {
  detectCallerGoodbye,
  detectWrongNumber,
  hasCallbackNumber,
  isSignOff,
} from "@/lib/voice/endCall";
import { shouldEscalate, type EscalationVerdict } from "@/lib/voice/escalation";
import { detectLocale } from "@/lib/voice/locale";
import { detectOptOut, optOutLine, recordOptOut } from "@/lib/voice/optOut";
import {
  NO_OWNER_SESSION,
  isOwnerNumber,
  ownerModeConfigured,
  ownerSession,
  type OwnerSession,
} from "@/lib/voice/owner";
import { ownerToolsFor, runOwnerTool } from "@/lib/voice/ownerTools";
import { findSolicitation, safeRedirectLine, solicitationFlag } from "@/lib/voice/solicitation";
import { looksLikeVoicemail } from "@/lib/voice/voicemail";

/**
 * ElevenLabs Agents — custom LLM endpoint.
 *
 * ElevenLabs hosts the whole call (STT, orchestration, TTS); the one thing it
 * doesn't own is what Ana actually says, which is this endpoint. It calls
 * here on every turn shaped exactly like an OpenAI /v1/chat/completions
 * request, and requires the response back as Server-Sent Events — non-
 * streaming replies are rejected outright, per ElevenLabs' custom-LLM docs.
 *
 * This is the direct replacement for /api/voice/turn (the turn-based TwiML
 * path, kept as the rollback route) and for the ConversationRelay bridge that
 * was cancelled before it shipped (Docs/Voice-Architecture-History.md) — same
 * brain (Claude, escalation, transcript), different transport.
 *
 * THREE PATHS LIVE HERE, and which one runs is decided by this file rather
 * than by ElevenLabs:
 *   - the receptionist, for a customer who called us;
 *   - owner mode, for a caller who cleared the number allowlist and spoke the
 *     PIN (src/lib/voice/owner.ts);
 *   - the outbound errand, for a call Ana placed, selected from the brief the
 *     dialer round-trips through `custom_llm_extra_body`.
 * The last one has to be decided here because a Custom LLM discards the system
 * prompt ElevenLabs sends, so overriding the prompt at dispatch time changes a
 * string this route throws away. See Docs/Voice-Outbound-Research.md §0(3).
 *
 * THE call_sid MYSTERY, SOLVED (2026-08-02, on a real call): every inbound
 * turn logged "no call_sid on this request" because /api/voice/el/init was
 * returning the correlation ids in `dynamic_variables` only. Dynamic variables
 * go to the post-call webhook; what ElevenLabs forwards to a Custom LLM every
 * turn is the SIBLING field `custom_llm_extra_body` (arriving here as
 * `elevenlabs_extra_body`). The Security-tab toggle was on the whole time —
 * the sender was the missing half, not the permission. init now sends both
 * fields, so this route learns the call id and the caller's number on every
 * turn; the same gap was why owner mode refused the owner's real number and
 * correct PIN (`caller_phone` never arrived, so eligibility was false).
 * The extraction stays best-effort and the derived-from-messages design stays:
 * when the ids are missing, Supabase writes silently no-op and the call keeps
 * working, which remains the right failure direction.
 *
 * Still UNVERIFIED on a live call: the bearer-auth arrival shape (appears to
 * work — a Forbidden would show in ElevenLabs' logs as instant silence).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TURNS = 40;

/**
 * An outbound errand should be over in under a minute. Forty turns is the
 * inbound intake budget; an outbound call still going at twelve has stopped
 * being an errand and should end while Ana can still close it gracefully.
 */
const MAX_OUTBOUND_TURNS = 12;

/**
 * UTR 4(d) wants the identification repeated once a call runs past sixty
 * seconds. ElevenLabs exposes `system__call_duration_secs` as a dynamic
 * variable, which is the real answer; the turn count is the fallback for when
 * it is absent, at a rough five seconds a turn each way.
 */
const REIDENTIFY_AFTER_SECONDS = 60;
const REIDENTIFY_AFTER_TURNS = 6;

type OpenAIMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  /** Present on tool-result messages; ElevenLabs mirrors the OpenAI shape. */
  name?: string;
  tool_calls?: Array<{ function?: { name?: string } }>;
};

function verifyBearer(request: Request): boolean {
  const secret = process.env.ELEVENLABS_CUSTOM_LLM_SECRET;
  if (!secret) {
    console.error("[voice-el] ELEVENLABS_CUSTOM_LLM_SECRET is not set — refusing the request");
    return false;
  }
  const header = request.headers.get("authorization") ?? "";
  const provided = header.replace(/^Bearer\s+/i, "");
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Best-effort extraction — see the UNVERIFIED note above. */
function extractCallSid(body: Record<string, unknown>): string | null {
  const extra = body.elevenlabs_extra_body as Record<string, unknown> | undefined;
  const dynamic = body.dynamic_variables as Record<string, unknown> | undefined;
  return (
    (extra?.call_sid as string) ??
    (dynamic?.call_sid as string) ??
    (body.call_sid as string) ??
    null
  );
}

/**
 * The caller's number, arriving the same way call_sid does — /api/voice/el/init
 * puts it in dynamic_variables and ElevenLabs round-trips it back on every turn.
 *
 * Same best-effort shape as extractCallSid, plus a type guard: this value is the
 * first factor of owner authentication, and a non-string that slipped through
 * would be compared against the allowlist as whatever it happened to be. When it
 * is absent the answer is null, isOwnerNumber() says no, and owner mode simply
 * does not exist for the call — which is the correct failure direction.
 */
function extractCallerPhone(body: Record<string, unknown>): string | null {
  const extra = body.elevenlabs_extra_body as Record<string, unknown> | undefined;
  const dynamic = body.dynamic_variables as Record<string, unknown> | undefined;
  const value =
    (extra?.caller_phone as unknown) ??
    (dynamic?.caller_phone as unknown) ??
    (body.caller_phone as unknown) ??
    null;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Which language /api/voice/el/init opened the call in.
 *
 * THE BUG THIS EXISTS FOR. The seed below used to be the literal "fr" on every
 * inbound call, and that quietly disagreed with the other half of the system:
 * init picks the opening language, sends it as `conversation_config_override`,
 * and ElevenLabs loads the matching VOICE from it. On an owner call init said
 * English — so the English voice was speaking — while this route started from
 * French and detectLocale() never found the two-word margin it needs to switch
 * (short replies like "any news?" score zero either way and return `current`).
 * Claude was therefore told "You are speaking French", wrote French, and the
 * English voice read it aloud with an English accent. Reported from a real
 * call, 2026-08-04.
 *
 * The decision is made in exactly one place now and travels here, rather than
 * being inferred twice from different evidence.
 */
function extractOpeningLocale(body: Record<string, unknown>): "fr" | "en" | null {
  const extra = body.elevenlabs_extra_body as Record<string, unknown> | undefined;
  const dynamic = body.dynamic_variables as Record<string, unknown> | undefined;
  const value =
    (extra?.locale as unknown) ?? (dynamic?.locale as unknown) ?? (body.locale as unknown) ?? null;
  return value === "fr" || value === "en" ? value : null;
}

/**
 * The admin dashboard's "Talk to Ana" widget — a THIRD way into owner mode,
 * alongside the phone's two-factor PIN.
 *
 * It skips the PIN entirely, and the reason is not that the boundary is
 * weaker here — it is that it has already been cleared by something stronger.
 * `/admin` re-verifies a real session cookie server-side on every request
 * (src/app/(internal)/admin/layout.tsx), and the ONLY place this exact widget
 * tag is ever rendered is a page behind that check
 * (src/app/(internal)/admin/ana/page.tsx). A caller cannot forge this value
 * by saying anything: dynamic_variables come from the widget's own
 * connection-initiation payload, never from transcript text, so there is no
 * utterance that produces it — the phone path and this path cannot be
 * confused for one another from either side.
 *
 * Deliberately a distinct literal ("authenticated") rather than a bare
 * boolean, so a stray truthy value from an unrelated field can never satisfy
 * it by accident.
 */
function extractDashboardSession(body: Record<string, unknown>): boolean {
  const extra = body.elevenlabs_extra_body as Record<string, unknown> | undefined;
  const dynamic = body.dynamic_variables as Record<string, unknown> | undefined;
  const value =
    (extra?.dashboard_owner_session as unknown) ??
    (dynamic?.dashboard_owner_session as unknown) ??
    (body.dashboard_owner_session as unknown) ??
    null;
  return value === "authenticated";
}

/**
 * The errand, on a call Ana placed.
 *
 * WHY THIS IS THE FORK. With a Custom LLM, ElevenLabs sends its own system
 * prompt as a `system` message and this route throws it away and substitutes
 * one of its own — so `conversation_config_override.agent.prompt.prompt`, the
 * obvious way to give an outbound call a different persona, changes a string
 * nobody reads. Docs/Voice-Outbound-Research.md §0(3) calls this the single
 * most important thing to understand before writing any of this. The persona
 * has to be chosen HERE, from per-call data the dialer round-trips through
 * `custom_llm_extra_body`, which arrives as top-level `elevenlabs_extra_body`.
 *
 * Read tolerantly from all three channels for the same reason extractCallSid()
 * is: "where exactly does this key land" has been the flakiest part of this
 * integration, and getting it wrong here does not degrade the call, it puts a
 * receptionist on a call she did not answer.
 *
 * TWO INDEPENDENT SIGNALS, because one of them failing is a persona swap
 * rather than a missing field: the explicit `mode`, and a call_sid carrying the
 * `task_` prefix, which only the outbound dialer ever mints (it is our own
 * correlation id, generated before dialling because the Twilio SID does not
 * exist yet — §2.3). A real Twilio SID starts `CA`.
 */
export type OutboundBrief = {
  kind: OutboundKind;
  payload: OutboundPayload;
  /** The queue row, for the post-call outcome write. */
  taskId: string | null;
  locale: "fr" | "en" | null;
};

function isOutboundCorrelationId(callSid: string | null): boolean {
  return typeof callSid === "string" && callSid.startsWith("task_");
}

function extractOutboundBrief(
  body: Record<string, unknown>,
  callSid: string | null,
): OutboundBrief | null {
  const extra = (body.elevenlabs_extra_body ?? {}) as Record<string, unknown>;
  const dynamic = (body.dynamic_variables ?? {}) as Record<string, unknown>;
  const pick = (key: string): unknown => extra[key] ?? dynamic[key] ?? body[key];

  const declared = pick("mode") === "outbound";
  if (!declared && !isOutboundCorrelationId(callSid)) return null;
  if (!declared) {
    console.error(
      "[voice-outbound] no mode flag on this request — treating it as outbound on the task_ correlation id alone",
      { callSid },
    );
  }

  const rawPayload = pick("payload");
  const payload =
    rawPayload && typeof rawPayload === "object" && !Array.isArray(rawPayload)
      ? (rawPayload as OutboundPayload)
      : {};

  const kind = pick("kind");
  if (!isOutboundKind(kind)) {
    // The column is check-constrained, so an unrecognised kind is a dialer bug
    // rather than data. Falling back to the receptionist would be far worse
    // than falling back to the mildest errand: confirm_visit asks whether
    // something still holds and promises nothing.
    console.error("[voice-outbound] unrecognised errand kind — defaulting to confirm_visit", {
      callSid,
      kind,
    });
  }

  const locale = pick("locale");
  const taskId = pick("task_id");

  return {
    kind: isOutboundKind(kind) ? kind : "confirm_visit",
    payload,
    taskId: typeof taskId === "string" && taskId.trim() ? taskId.trim() : null,
    locale: locale === "fr" || locale === "en" ? locale : null,
  };
}

/**
 * Owner mode does not exist on a call we placed. Not "is unlikely to trigger" —
 * does not exist.
 *
 * The owner may perfectly well have queued an errand to a number that is on
 * OWNER_PHONE_NUMBERS (his own mobile, a test call), and the CRM tools must not
 * become reachable because of it. This is the same reasoning as ownerToolsFor()
 * returning [] for an unauthenticated session, one layer earlier.
 *
 * It matters more now than it used to. Owner mode used to need a spoken PIN on
 * top of the number, so an errand dialled to his own mobile still would not
 * have opened the CRM; with the number alone sufficient, this branch is the
 * only thing standing between "we called Artush's phone" and "we handed the
 * CRM to whoever answered it". NO_OWNER_SESSION is imported from owner.ts so
 * there is exactly one definition of what "not the owner" means.
 */

/** How far into the call we are, for the sixty-second re-identification. */
function callDurationSeconds(body: Record<string, unknown>): number | null {
  const dynamic = (body.dynamic_variables ?? {}) as Record<string, unknown>;
  const raw = dynamic.system__call_duration_secs;
  const value = typeof raw === "string" ? Number(raw) : raw;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Locale and escalation state, recomputed from the conversation rather than
 * read back from Supabase.
 *
 * Both used to come from a getCallBySid() round-trip taken *before* Claude was
 * called — a blocking database read sitting in front of every single turn, and
 * the caller pays for it in silence. Neither value needs the database:
 * ElevenLabs sends the whole conversation on every request, and both
 * detectLocale() and shouldEscalate() are pure functions of it. Folding them
 * over the history is microseconds of string comparison against at most 40
 * short turns, and it takes a network hop off the hot path entirely.
 *
 * Escalation is sticky by design — shouldEscalate() short-circuits to true when
 * alreadyEscalated is set — so folding reproduces exactly what the stored
 * escalated_at flag meant: once this call has needed Sonnet, it keeps Sonnet.
 */
function deriveCallState(
  callerTurnTexts: string[],
  // French unless told otherwise, which is the right default for Laval and the
  // only value inbound ever passes. An outbound errand carries the contact's
  // last known language on the task row, and starting an English household in
  // French would waste the first turn of a call that should last one minute.
  seed: "fr" | "en" = "fr",
  // Set on the owner's own line, where the language is not a thing to be
  // sniffed out — he asked for English and English is what he gets. Without
  // it, a Montrealer's perfectly ordinary "oui" and "merci" inside an English
  // sentence are two French function words, which is exactly the margin
  // detectLocale() needs to flip the whole call into French.
  options: { locked?: boolean } = {},
): {
  locale: "fr" | "en";
  alreadyEscalated: boolean;
} {
  let locale: "fr" | "en" = seed;
  let alreadyEscalated = false;

  for (let i = 0; i < callerTurnTexts.length; i++) {
    const turn = callerTurnTexts[i];
    if (!options.locked) locale = detectLocale(turn, locale);
    if (!alreadyEscalated) {
      alreadyEscalated = shouldEscalate(turn, callerTurnTexts.slice(0, i)).escalate;
    }
  }

  return { locale, alreadyEscalated };
}

function sseChunk(delta: Record<string, unknown>, finishReason: string | null = null) {
  const payload = {
    id: `chatcmpl-ana`,
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    choices: [{ index: 0, delta, finish_reason: finishReason }],
  };
  return `data: ${JSON.stringify(payload)}\n\n`;
}

/**
 * HANGING UP — the third system tool this route has to invoke by hand, and the
 * one with an ordering problem the other two do not have.
 *
 * `end_call` is enabled on the agent (it sits under System tools next to Detect
 * language), and enabling it there does nothing at all: with a Custom LLM,
 * ElevenLabs passes every system tool through to us and waits for us to call
 * it. So until now several branches said "end the call" and Ana simply stopped
 * talking and waited — worst of all on the opt-out, where the one person we
 * must not keep on the phone is the person who just asked never to be called
 * again.
 *
 * THE CLOSING LINE TRAVELS INSIDE THE TOOL CALL, and this is the decision worth
 * understanding. There were three ways to order speech and hangup:
 *
 *   (a) Speak the closing as `content`, then emit the tool in the same
 *       response. Rejected: ElevenLabs is free to act on the tool as soon as
 *       the stream closes, and the text may still be in the synthesiser. There
 *       is already a call in this project's history that ended mid-word.
 *   (b) Speak the closing on one turn, emit the tool on the next. Rejected, and
 *       not because it is slow — because there IS no next turn. A response that
 *       finishes with `stop` hands the floor back to the caller, and ElevenLabs
 *       only calls this endpoint again when the caller speaks. That is exactly
 *       the bug being fixed.
 *   (c) Emit no text at all and put the closing in the tool's `message`
 *       argument, which ElevenLabs speaks before terminating. Chosen: the
 *       platform owns the sequencing, so there is nothing left to race.
 *
 * The consequence is that every branch which hangs up must have its closing
 * sentence in hand *before* it decides to hang up. That is why inbound's
 * goodbye and outbound's wrong-number branch use fixed lines and never ask
 * Claude, and why the outbound errand — which is generated but not streamed —
 * can carry the model's own closing here while inbound's streamed replies
 * cannot.
 *
 * UNVERIFIED against the live service: the SSE shape below mirrors
 * `voicemail_detection` and `language_detection`, both of which are known to
 * work, and `message` is the documented second parameter of ElevenLabs'
 * `end_call`. Nobody has placed a real call through it. See the note in
 * Docs/Voice-ElevenLabs-Setup.md.
 */
function endCallChunks(options: { reason: string; message?: string }): string[] {
  const args: Record<string, string> = { reason: options.reason };
  if (options.message) args.message = options.message;

  return [
    sseChunk({
      role: "assistant",
      tool_calls: [
        {
          index: 0,
          id: `call_end_${Date.now()}`,
          type: "function",
          function: { name: "end_call", arguments: "" },
        },
      ],
    }),
    sseChunk({ tool_calls: [{ index: 0, function: { arguments: JSON.stringify(args) } }] }),
    sseChunk({}, "tool_calls"),
    "data: [DONE]\n\n",
  ];
}

export async function POST(request: Request) {
  if (!verifyBearer(request)) {
    return new Response("Forbidden", { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || !Array.isArray(body.messages)) {
    return Response.json({ error: "messages required" }, { status: 400 });
  }

  const messages = body.messages as OpenAIMessage[];
  const callSid = extractCallSid(body);
  if (!callSid) {
    console.error("[voice-el] no call_sid on this request — see UNVERIFIED note in this file");
  }

  // ElevenLabs sends the full running conversation on every turn — that, not
  // a Supabase read keyed on call_sid, is the authoritative record of what
  // Ana has already said. The previous version read history back from
  // Supabase instead: a single failed call_sid round-trip (which is what was
  // actually happening) made every turn look like the first, so priorTurns
  // came back empty and Ana re-asked her opening question for the entire
  // call. Supabase is still written to below for the CRM transcript — it's
  // just no longer read back to decide what Claude sees.
  //
  // After ElevenLabs runs a system tool (language_detection, below) it calls
  // straight back with a `tool` role message appended. The caller has not said
  // anything new on that turn — the last *user* message is still the one that
  // triggered the switch — so "what was just spoken" has to be found by role
  // rather than by position. Reading the last message blindly would see the
  // tool result, treat the turn as silence, and answer with the fallback line
  // in the language the caller just switched away from.
  const isToolResultTurn = messages.at(-1)?.role === "tool";

  // Outbound or not. Everything downstream forks on this, and nothing about
  // the inbound path changes when it is null.
  const outbound = extractOutboundBrief(body, callSid);

  // Computed here, ahead of everything else that reads it, because the locale
  // seed below needs it too. A dashboard-originated request is never also
  // treated as a phone caller who happens to know the PIN — see
  // extractDashboardSession for why that value can only ever come from an
  // already-authenticated session.
  const fromDashboard = !outbound && extractDashboardSession(body);

  // Emitted at most once per call. voicemail_detection ends the conversation on
  // ElevenLabs' side, but if it ever comes back for another turn instead, this
  // stops the route re-emitting the tool against its own tool result forever.
  const voicemailAlreadyEmitted = messages.some(
    (m) =>
      m.tool_calls?.some((t) => t.function?.name === "voicemail_detection") ||
      (m.role === "tool" && m.name === "voicemail_detection"),
  );

  // Same guard, same two channels, for the tool that ends the call. In theory
  // it cannot fire twice — the call is over — but "in theory the call is over"
  // is precisely the assumption that would have this route emitting end_call
  // against its own tool result in a loop if ElevenLabs ever comes back for
  // another turn. Every branch below degrades to speaking its closing line as
  // ordinary text when this is set, so the caller still hears a goodbye.
  const endCallAlreadyEmitted = messages.some(
    (m) =>
      m.tool_calls?.some((t) => t.function?.name === "end_call") ||
      (m.role === "tool" && m.name === "end_call"),
  );

  const conversational = messages.filter((m) => m.role === "user" || m.role === "assistant");
  const lastUserIndex = conversational.map((m) => m.role).lastIndexOf("user");
  const spoken = lastUserIndex >= 0 ? (conversational[lastUserIndex].content?.trim() ?? "") : "";
  const priorTurns: CallTurn[] = conversational
    .slice(0, Math.max(lastUserIndex, 0))
    .filter((m) => (m.content ?? "").trim().length > 0)
    .map((m) => ({
      role: m.role === "user" ? "caller" : "agent",
      text: m.content ?? "",
      at: new Date().toISOString(),
    }));

  // THE OWNER'S OWN LINE RUNS IN ENGLISH, AND STAYS THERE.
  //
  // Recognised by caller ID, which is a filter and not proof — this decides a
  // language and nothing else, and the PIN still gates every figure Ana reads
  // out. Read before the seed because it IS the seed on his calls.
  //
  // Locked rather than merely seeded, because he asked for "full English" and
  // seeding alone would not deliver it: he is a Montrealer, "oui" and "merci"
  // land in his English sentences without him noticing, and two French
  // function words are precisely the margin detectLocale() switches on.
  const rawCallerPhone = extractCallerPhone(body);
  const ownerLine = !outbound && ownerModeConfigured() && isOwnerNumber(rawCallerPhone);

  // A dashboard-originated call defaults to English (Artush's own working
  // language in the admin); a phone call takes whatever /api/voice/el/init
  // opened it in — see extractOpeningLocale for why guessing that again here
  // rather than being told it was a bug — and falls back to the phone's
  // long-standing French-for-Laval default.
  const localeSeed: "fr" | "en" =
    outbound?.locale ??
    (ownerLine || fromDashboard ? "en" : (extractOpeningLocale(body) ?? "fr"));

  const priorCallerTexts = callerTurns({ turns: priorTurns });
  const { locale: priorLocale, alreadyEscalated } = deriveCallState(priorCallerTexts, localeSeed, {
    locked: ownerLine,
  });

  // Where this call stands with owner mode. A pure function of the caller's
  // number now — no database read, and nothing the caller SAYS can move it,
  // which is a real improvement on the PIN this replaced: that version had to
  // read every utterance looking for a code, and "reads what the caller said
  // in order to decide what the caller may see" is a shape worth being rid of.
  //
  // On an outbound call none of it applies and the number is forced to null
  // rather than trusted to be absent — the dialer does not set `caller_phone`,
  // but "it isn't sent" is an assumption and this is the one place where being
  // wrong about it hands the CRM to whoever we happened to dial.
  if (outbound && rawCallerPhone) {
    console.error(
      "[voice-outbound] an outbound request carried caller_phone — ignoring it; the dialer must not send it",
      { callSid },
    );
  }
  const callerPhone = outbound ? null : rawCallerPhone;
  const session: OwnerSession = outbound
    ? NO_OWNER_SESSION
    : fromDashboard
      ? { authenticated: true }
      : ownerSession(callerPhone);
  // Once per call, on the opening turn. Logged because owner mode now rests on
  // caller ID alone: if a session ever opens that shouldn't have, this line and
  // the number beside it are the whole audit trail.
  if (session.authenticated && priorTurns.length === 0) {
    console.info("[voice-owner] owner mode open", {
      callSid,
      via: fromDashboard ? "dashboard" : "caller-id",
    });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (text: string) => controller.enqueue(encoder.encode(text));

      /** Hang up, saying nothing more. */
      const hangUp = (options: { reason: string; message?: string }) => {
        for (const chunk of endCallChunks(options)) send(chunk);
      };

      /**
       * Say this, then hang up — the shape every ending branch uses.
       *
       * The fallback when end_call has already gone out is to speak the line as
       * ordinary text and stop. A caller who somehow gets a second turn after
       * the tool fired hears the goodbye rather than silence, and the route
       * does not sit in a loop emitting a tool against its own result.
       */
      const closeWith = (message: string, reason: string) => {
        if (endCallAlreadyEmitted) {
          send(sseChunk({ role: "assistant", content: message }, "stop"));
          send("data: [DONE]\n\n");
          return;
        }
        hangUp({ reason, message });
      };

      if (!spoken) {
        send(
          sseChunk(
            {
              role: "assistant",
              content: outbound ? outboundSilenceLine(priorLocale) : fallbackLine(priorLocale),
            },
            "stop",
          ),
        );
        send("data: [DONE]\n\n");
        controller.close();
        return;
      }

      let locale: "fr" | "en" = priorLocale;

      try {
        if (priorTurns.length >= (outbound ? MAX_OUTBOUND_TURNS : MAX_TURNS)) {
          if (callSid) await endCall(callSid, { status: "completed" }).catch(() => {});
          // The owner gets a different goodbye: promising him a callback from
          // his own estimator is the customer script leaking into a call it
          // does not belong in. So does an outbound call, which by now is
          // certainly past a minute and owes them the identification again.
          const closing = outbound
            ? outboundClosingLine(locale)
            : session.authenticated
              ? locale === "fr"
                ? "On a fait le tour, je raccroche. Rappelle quand tu veux."
                : "That's the lot — I'll hang up here. Call back any time."
              : locale === "fr"
                ? "Merci, j'ai ce qu'il me faut. Notre estimateur vous rappelle très bientôt. Bonne journée!"
                : "Thank you, I have what I need. Our estimator will call you back very soon. Have a great day!";
          // This branch used to speak the closing and then rely on the caller
          // hanging up, which on a call that has already run forty turns is a
          // lot to ask of them.
          closeWith(closing, "the conversation reached its turn limit");
          return;
        }

        // ANSWERING MACHINE, before anything else.
        //
        // voicemail_detection is a system tool, and with a Custom LLM
        // configured ElevenLabs hands every system tool to the LLM and waits
        // for the LLM to invoke it — it does not run them itself. Enabling the
        // toggle in the dashboard therefore does exactly nothing on its own.
        // This is the same trap that pinned the conversation language to
        // French for a week before language_detection was emitted by hand
        // below, so the shape here is deliberately identical to that one.
        //
        // Checked ahead of the language fork: a mailbox greeting in the other
        // language would otherwise burn the turn on language_detection and
        // talk to the machine in better French.
        //
        // Suppressed on a tool-result turn as well as on an already-emitted
        // one, and for the same reason language_detection is: ElevenLabs calls
        // straight back with the tool's result appended and the caller's last
        // utterance unchanged, so re-reading it would emit the tool against its
        // own result forever. Two guards rather than one because the named
        // check is the durable one and the tool-result check is the one that
        // holds even if ElevenLabs' echo of our tool call is shaped
        // differently from the OpenAI convention.
        if (outbound && !isToolResultTurn && !voicemailAlreadyEmitted) {
          const verdict = looksLikeVoicemail(spoken, { turnIndex: priorCallerTexts.length });
          if (verdict.voicemail) {
            console.info("[voice-outbound] answering machine", { callSid, reason: verdict.reason });
            send(
              sseChunk({
                role: "assistant",
                tool_calls: [
                  {
                    index: 0,
                    id: `call_vm_${Date.now()}`,
                    type: "function",
                    function: { name: "voicemail_detection", arguments: "" },
                  },
                ],
              }),
            );
            send(
              sseChunk({
                tool_calls: [
                  { index: 0, function: { arguments: JSON.stringify({ reason: verdict.reason }) } },
                ],
              }),
            );
            send(sseChunk({}, "tool_calls"));
            send("data: [DONE]\n\n");
            return;
          }
        }

        // THE MAILBOX MESSAGE IS DONE.
        //
        // voicemail_detection is supposed to be terminal — ElevenLabs plays the
        // configured message and ends the conversation itself — so reaching
        // here means it did not, and Ana is on an open line reciting an errand
        // to a tape. Nothing left to say that a machine can act on, and no
        // `message` argument for the same reason: the message has already been
        // left, and leaving a second one is how a business becomes a nuisance.
        if (outbound && voicemailAlreadyEmitted && !endCallAlreadyEmitted) {
          console.info("[voice-outbound] the mailbox message is done — hanging up", { callSid });
          if (callSid) await endCall(callSid, { status: "completed" }).catch(() => {});
          hangUp({ reason: "the message has been left on the answering machine" });
          return;
        }

        // Not consulted on the owner's line — see `ownerLine` above. Leaving
        // detection running here would undo the lock one turn later: the seed
        // would open in English and the first "oui, merci" would switch the
        // conversation, which is the exact complaint this is fixing.
        const detected = ownerLine ? locale : detectLocale(spoken, locale);
        const localeChanged = detected !== locale;
        locale = detected;

        // The caller has switched language. Announce it through the
        // language_detection system tool rather than simply replying in the
        // new language, because the conversation's language is what selects
        // the voice: without this call ElevenLabs keeps speaking through the
        // French voice, so English comes out with a French accent — exactly
        // the thing the owner rejected. Emitting a tool call means no text
        // this turn; ElevenLabs runs the tool and immediately calls back, and
        // the reply is generated on that second pass.
        //
        // Skipped on a tool-result turn so a detectLocale that stays
        // unconvinced cannot bounce the call between languages forever.
        if (localeChanged && !isToolResultTurn) {
          send(
            sseChunk({
              role: "assistant",
              tool_calls: [
                {
                  index: 0,
                  id: `call_lang_${Date.now()}`,
                  type: "function",
                  function: { name: "language_detection", arguments: "" },
                },
              ],
            }),
          );
          send(
            sseChunk({
              tool_calls: [
                {
                  index: 0,
                  function: {
                    arguments: JSON.stringify({
                      reason: "the caller switched language",
                      language: locale,
                    }),
                  },
                },
              ],
            }),
          );
          send(sseChunk({}, "tool_calls"));
          send("data: [DONE]\n\n");
          if (callSid) await setCallLocale(callSid, locale).catch(() => {});
          return;
        }

        // THE INBOUND CALLER SAID GOODBYE, AND THE INTAKE IS DONE.
        //
        // Deliberately the most reluctant ending in this file. Hanging up a few
        // seconds late costs nothing anyone notices; hanging up on a customer
        // who was gathering their thoughts costs the lead, and it is the one
        // failure the owner would hear about. So three conditions have to hold
        // at once, and any of them missing means Ana carries on:
        //
        //   - The utterance is unambiguously a goodbye. detectCallerGoodbye()
        //     refuses questions, anything longer than a breath, and anything
        //     carrying "attendez"/"one more thing". A pause produces no text at
        //     all and is handled far above by the silence branch — a lull is
        //     never an ending.
        //   - We can reach them again. Caller ID satisfies this on any normal
        //     inbound call; a spoken number covers the withheld ones. Without
        //     either, this is a lead we would be discarding, so Ana stays on.
        //   - It is not the owner. He has no intake to complete, and the turn
        //     limit already gives his calls an ending of their own.
        //
        // Claude is not consulted, and cannot be: the closing has to exist
        // before the decision, because it rides inside the tool call. Note also
        // what is NOT here — Ana signing off on her own does not end an inbound
        // call. She writes "bonne journée" while the caller still has something
        // to add often enough that acting on it would cut people off.
        if (
          !outbound &&
          !session.authenticated &&
          detectCallerGoodbye(spoken) &&
          hasCallbackNumber(priorCallerTexts, { callerId: rawCallerPhone })
        ) {
          const line = inboundFarewellLine(locale);
          closeWith(line, "the caller said goodbye and the intake is complete");
          if (callSid) {
            await Promise.allSettled([
              appendTurns(callSid, [
                { role: "caller", text: spoken, at: new Date().toISOString() },
                { role: "agent", text: line, at: new Date().toISOString() },
              ]),
              localeChanged ? setCallLocale(callSid, locale) : null,
              endCall(callSid, { status: "completed" }),
            ]);
          }
          return;
        }

        // Escalation is an inbound idea. An outbound errand has no analytical
        // work in it, and a call that is going badly should end rather than get
        // smarter — so it stays on Haiku and nothing gets marked escalated.
        const verdict: EscalationVerdict = outbound
          ? { escalate: false, repeatCount: 0, reason: null }
          : shouldEscalate(spoken, priorCallerTexts, { alreadyEscalated });

        const callerTurn: CallTurn = { role: "caller", text: spoken, at: new Date().toISOString() };

        // Streamed token-by-token so ElevenLabs can start speaking on the
        // first few words instead of waiting for the whole reply — the
        // single-chunk version this replaced added Claude's entire
        // generation time to every turn's silence before Ana said anything.
        let sentAny = false;
        const onDelta = (delta: string) => {
          if (!delta) return;
          send(sseChunk(sentAny ? { content: delta } : { role: "assistant", content: delta }));
          sentAny = true;
        };

        // The fork, now three ways. An authenticated owner gets Sonnet with the
        // read-only CRM tools; a call Ana placed gets the outbound errand
        // persona and no tools at all; everyone else takes exactly the path
        // they took before either existed — same model, same prompt, no tools,
        // no extra round trips. `session.authenticated` is the only gate on
        // owner mode, ownerToolsFor() hands back an empty array for anything
        // else, and outbound has already been forced to NO_OWNER_SESSION, so
        // there is no state in which a customer call can reach a tool.
        //
        // `flag` carries a guardrail trip through to the stored transcript.
        let reply: AgentReply;
        let flag: string | null = null;

        /**
         * Set when this turn is the last one. The tool is emitted at the very
         * bottom, next to where the reply would otherwise be finished with
         * `stop`, so that a single place decides between "say this and wait"
         * and "say this and hang up" — and so the transcript is written either
         * way. Only the outbound errand sets it: every other ending branch has
         * its closing line up front and returns early.
         */
        let ending: { message: string; reason: string } | null = null;

        if (outbound) {
          // "DON'T CALL ME AGAIN" — ahead of everything, including the
          // identification. B6 outranks every other rule on this call and says
          // the turn is one turn: apologise, say what has been done, wish them
          // a good day, end. Reciting fifteen seconds of regulatory disclosure
          // at somebody who has just asked to be left alone is the opposite of
          // honouring it.
          //
          // This is the one write an outbound call performs, and the one that
          // cannot be left to the post-call webhook: that webhook is a network
          // call that can fail, and its failure mode here is telephoning
          // someone again after promising them you would not. So the row is
          // written first and the sentence is chosen from what came back — Ana
          // only says "I'm taking you off the list right now" when it is
          // already true. Deterministic rather than a tool the model reaches
          // for, because this is the request where a miss is the expensive one.
          if (detectOptOut(spoken)) {
            const result = await recordOptOut(callSid);
            const line = optOutLine(locale, result);
            // And then go, which is the half that was missing: Ana used to
            // confirm the removal and stay on the line, holding open a call
            // with the one person who had just asked never to hear from us
            // again. The confirmation is spoken by ElevenLabs out of the tool's
            // `message` argument, so it completes before the line drops.
            closeWith(line, "the customer asked never to be called again");
            if (callSid) {
              await Promise.allSettled([
                appendTurns(callSid, [
                  { role: "caller", text: spoken, at: new Date().toISOString() },
                  {
                    role: "agent",
                    text: line,
                    at: new Date().toISOString(),
                    flagged: `opt_out:${result}`,
                  },
                ]),
                endCall(callSid, { status: "completed" }),
              ]);
            }
            return;
          }

          // WRONG NUMBER — branch B7, and checked here for the same reason the
          // opt-out is: ahead of the identification.
          //
          // Someone who is not our customer should not be read fifteen seconds
          // of regulatory disclosure about a household that is not theirs, and
          // the branch has two prohibitions a generated sentence could walk
          // into — never repeat the contact's name (that would be telling a
          // stranger who we are calling) and never ask them anything at all. So
          // the line is fixed and the model is not consulted.
          //
          // Flagged rather than suppressed: a bad record is not a refusal, and
          // do_not_call would mean that the day somebody corrects the number,
          // the customer is permanently unreachable.
          if (detectWrongNumber(spoken)) {
            const line = wrongNumberLine(locale);
            console.info("[voice-outbound] wrong number — apologising and hanging up", {
              callSid,
              taskId: outbound.taskId,
            });
            closeWith(line, "wrong number");
            if (callSid) {
              await Promise.allSettled([
                appendTurns(callSid, [
                  { role: "caller", text: spoken, at: new Date().toISOString() },
                  {
                    role: "agent",
                    text: line,
                    at: new Date().toISOString(),
                    flagged: "wrong_number",
                  },
                ]),
                endCall(callSid, { status: "completed" }),
              ]);
            }
            return;
          }

          // THE IDENTIFICATION, IF NOTHING ELSE SAID IT.
          //
          // It should already have been spoken as ElevenLabs' per-call
          // first_message. Whether that override actually landed depends on the
          // dispatch payload and on a toggle in the agent's Security tab, and
          // neither is visible from here — so rather than assume, look at what
          // is in the transcript. UTR 4(d) is not satisfied by an opening that
          // was configured, only by one that was said, and the cost of saying
          // it twice is an awkward call while the cost of never saying it is a
          // complaint the business cannot answer.
          const identified = priorTurns.some(
            (turn) => turn.role === "agent" && hasSpokenOutboundDisclosure(turn.text),
          );
          let openingSpoken = "";
          if (!identified) {
            console.error(
              "[voice-outbound] no identification in the transcript — speaking the opening now",
              { callSid, taskId: outbound.taskId },
            );
            openingSpoken = `${outboundOpening(outbound.kind, outbound.payload, locale)} `;
            send(sseChunk({ role: "assistant", content: openingSpoken }));
            sentAny = true;
          }

          // Not streamed, and that is the point — see outboundReply(). The
          // deny-list has to see the whole sentence while it can still be
          // swapped for another one, and a delta already sent is a delta
          // already being spoken.
          const seconds = callDurationSeconds(body);
          reply = await outboundReply([...priorTurns, callerTurn], {
            kind: outbound.kind,
            payload: outbound.payload,
            locale,
            pastOneMinute:
              seconds != null
                ? seconds >= REIDENTIFY_AFTER_SECONDS
                : priorTurns.length >= REIDENTIFY_AFTER_TURNS,
          });

          // Layer (b) of Docs/Voice-Outbound-Compliance.md §10D(15). The prompt
          // forbids solicitation and the model complies almost always; "almost"
          // is the entire reason this exists, because the cost of the exception
          // is that the call was ADAD telemarketing without express consent.
          const hit = findSolicitation(reply.text, { scope: "outbound" });
          if (hit) {
            flag = solicitationFlag(hit, "outbound");
            console.error("[voice-outbound] blocked a solicitation before it was spoken", {
              callSid,
              taskId: outbound.taskId,
              rule: hit.rule,
              matched: hit.matched,
            });
            reply = { ...reply, text: safeRedirectLine(locale) };
          }
          if (!reply.text) reply = { ...reply, text: outboundFallbackLine(locale) };

          // IS THAT THE END OF THE ERRAND? Decided before a syllable goes out,
          // because a delta already sent cannot be moved into the tool call —
          // the same constraint that makes outbound non-streaming in the first
          // place, now buying a second thing with the latency it already spent.
          //
          // Two signals, and either is enough:
          //   - The customer asked to get off the phone. Whatever Ana was going
          //     to say next, this is the last thing she says.
          //   - Ana closed. Both prompts end with "wish them a good day, and do
          //     not add a question after the closing", so a farewell with no
          //     question in it is her saying the errand is answered — which on
          //     a call with exactly one question in it is the whole job.
          //
          // Suppressed on the turn the identification had to be spoken: that
          // opening is already streamed as text above, so the closing could not
          // travel in the tool call without being said twice — and a call that
          // has only just met its disclosure obligation should not hang up in
          // the same breath.
          const askedToHangUp = detectCallerGoodbye(spoken);
          const closed = isSignOff(reply.text);
          if (!openingSpoken && !endCallAlreadyEmitted && (askedToHangUp || closed)) {
            ending = {
              message: reply.text,
              reason: askedToHangUp
                ? "the customer asked to end the call"
                : "the errand is done and acknowledged",
            };
          } else {
            send(
              sseChunk(
                sentAny ? { content: reply.text } : { role: "assistant", content: reply.text },
              ),
            );
            sentAny = true;
          }
          // The transcript has to record the opening too, or the next turn
          // would look at it, see no identification, and say the whole thing
          // again.
          reply = { ...reply, text: `${openingSpoken}${reply.text}` };
        } else {
          reply = session.authenticated
            ? await ownerReplyToStream(
                [...priorTurns, callerTurn],
                {
                  locale,
                  tools: ownerToolsFor(session),
                  runTool: (name, input) => runOwnerTool(session, name, input, { locale, callSid }),
                },
                onDelta,
              )
            : await replyToStream(
                [...priorTurns, callerTurn],
                // Nothing owner-shaped is passed any more. There is no longer a
                // half-authenticated state to describe: the number either opens
                // owner mode outright, in which case this branch is not the one
                // running, or it does not and this is an ordinary call.
                { locale, escalated: verdict.escalate },
                onDelta,
              );

          // Same deny-list, narrower scope, and no interception: inbound is
          // streamed, so by the time the reply is complete the caller has
          // already heard it and there is nothing left to block. What §10D(15)
          // asks for on this side is (c), the review flag — and sharing the
          // implementation rather than writing a second one is the point.
          // Nothing about what the caller hears changes.
          const hit = findSolicitation(reply.text, { scope: "inbound" });
          if (hit) {
            flag = solicitationFlag(hit, "inbound");
            console.error("[voice-el] a spoken reply tripped the no-solicitation deny-list", {
              callSid,
              rule: hit.rule,
              matched: hit.matched,
            });
          }
        }

        if (ending) {
          hangUp(ending);
        } else {
          if (!sentAny) {
            send(
              sseChunk({
                role: "assistant",
                content: session.authenticated ? ownerFallbackLine(locale) : fallbackLine(locale),
              }),
            );
          }
          send(sseChunk({}, "stop"));
          send("data: [DONE]\n\n");
        }

        const agentTurn: CallTurn = {
          role: "agent",
          text: reply.text,
          at: new Date().toISOString(),
          model: reply.model,
          escalated: verdict.escalate || undefined,
          flagged: flag ?? undefined,
        };

        // Every Supabase write happens here, after the caller has already heard
        // the reply — nothing the CRM needs is worth adding silence to a live
        // call. Settled together rather than awaited in sequence, and each
        // failure is swallowed: a dropped transcript row is a reporting gap,
        // not a reason to break a phone call.
        //
        // The caller's turn is now stored verbatim. It used to be run through
        // redactOwnerPin() on owner-eligible calls, because a spoken PIN would
        // otherwise be filed in plaintext next to the number it authenticated.
        // With no PIN there is no secret in the transcript to strike out, and
        // the redactor is gone rather than left running over nothing — it
        // blanked any digit run of that length, so keeping it would quietly
        // eat callback numbers for no remaining benefit.
        if (callSid) {
          await Promise.allSettled([
            appendTurns(callSid, [callerTurn, agentTurn]),
            localeChanged ? setCallLocale(callSid, locale) : null,
            verdict.escalate && !alreadyEscalated && verdict.reason
              ? markEscalated(callSid, verdict.reason)
              : null,
            ending ? endCall(callSid, { status: "completed" }) : null,
          ]);
        }
      } catch (err) {
        console.error("[voice-el] chat failed:", err);
        if (callSid) await endCall(callSid, { status: "failed" }).catch(() => {});
        // Branch B11. The customer fallback asks for a name and number, which
        // is nonsense said to someone we dialled because we already have both.
        send(
          sseChunk(
            {
              role: "assistant",
              content: outbound ? outboundFallbackLine(locale) : fallbackLine(locale),
            },
            "stop",
          ),
        );
        send("data: [DONE]\n\n");
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
