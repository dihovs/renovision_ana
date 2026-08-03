import { db } from "@/lib/crm/db";

/**
 * "Don't call me again" — recognised broadly, and honoured before she says so.
 *
 * THIS IS THE ONE WRITE AN OUTBOUND CALL PERFORMS, and it is the only thing in
 * the whole outbound path that cannot wait for the post-call webhook. That
 * webhook is a network call that can fail, and its failure mode here is
 * telephoning someone again after promising them you would not. Ana says "I'm
 * taking you off the list right now"; that sentence has to be true at the
 * moment it is spoken, so the row is written first and the sentence is chosen
 * from what the write returned. Docs/Voice-Outbound-Conversation.md §6.
 *
 * DETECTED IN CODE RATHER THAN LEFT TO THE MODEL. The design sketch proposed a
 * `record_opt_out` tool for the model to invoke, which is a reasonable shape
 * and a worse guarantee: a tool the model can reach for is a tool the model can
 * fail to reach for, and this is the request where a miss is the expensive one.
 * A deterministic check on what the customer actually said cannot be talked out
 * of firing. The post-call analysis writes the flag again, idempotently — belt
 * and braces on the one field where being wrong has a real cost.
 *
 * RECOGNISED BROADLY, per B6: explicit phrases, and plain anger at being
 * called. A wrongly-honoured opt-out costs one phone call; a missed one costs
 * the customer. Where a phrase is genuinely ambiguous ("don't call me before
 * nine" is a scheduling preference, not a refusal) the qualifier is required —
 * that is the only concession, and it is there because suppressing appointment
 * confirmations for someone who was asking for a later callback helps nobody.
 */

const OPT_OUT_PATTERNS: RegExp[] = [
  // ---- French -------------------------------------------------------------
  /\barr[êe]te[zr]?\s+de\s+(?:m'|nous\s+)?appeler/i,
  /\bne\s+(?:m'|me\s+|nous\s+)?(?:rappelez|appelez|rappeler|appeler)\s+(?:plus|jamais)/i,
  /\b(?:enlevez|retirez|effacez|sortez)[-\s]?(?:moi|nous)\b/i,
  /\bje\s+ne\s+veux\s+plus\s+(?:d'|de\s+)?(?:appels?|vous\s+entendre)/i,
  /\bje\s+ne\s+veux\s+pas\s+(?:parler|jaser)\s+(?:[àa])\s+(?:un[e]?\s+)?(?:robot|machine|ordinateur|intelligence)/i,
  /\b(?:laissez|laisse)[-\s]?(?:moi|nous)\s+tranquille/i,
  /\bfoutez[-\s]?(?:moi|nous)\s+la\s+paix/i,
  /\bc'est\s+du\s+harc[èe]lement\b/i,
  /\bliste\s+d'exclusion\b/i,

  // ---- English ------------------------------------------------------------
  /\b(?:stop|quit)\s+(?:calling|phoning|ringing)/i,
  /\bdon'?t\s+(?:call|phone|ring)\s+(?:me|us|here|this\s+number)\s*(?:again|any\s?more|ever|back)/i,
  /\bdon'?t\s+(?:call|phone)\s+here\b/i,
  /\bnever\s+(?:call|phone|ring)\s+(?:me|us|here|again)/i,
  /\b(?:take|get)\s+(?:me|us)\s+off\s+(?:your|the|this)\b/i,
  /\bremove\s+(?:me|us|this\s+number)\s+from\b/i,
  /\bdo\s+not\s+call\s+(?:list|me\s+again)/i,
  /\bleave\s+(?:me|us)\s+alone\b/i,
  /\bdon'?t\s+want\s+to\s+(?:talk|speak|deal)\s+(?:to|with)\s+(?:a\s+)?(?:robot|machine|computer|bot|recording)/i,
  /\bunsubscribe\b/i,
  /\bthis\s+is\s+harassment\b/i,
];

export function detectOptOut(text: string): boolean {
  if (!text) return false;
  return OPT_OUT_PATTERNS.some((re) => re.test(text));
}

export type OptOutResult = "recorded" | "no_contact" | "unavailable";

/**
 * Suppress this number, now.
 *
 * Keyed on the correlation id, which resolves to the queue row, which carries
 * the client the number was verified against at queue time. Suppression lives
 * on the client rather than on the call task because an opt-out is about the
 * person and has to outlive whichever call it was said on — and because
 * `canDialNow()` in src/lib/crm/callTasks.ts already refuses to dial a client
 * carrying the flag, so writing it here is what stops the next call.
 *
 * Never throws. The caller has a customer waiting on the line, and the answer
 * it needs is only ever "may Ana truthfully say it is done".
 */
export async function recordOptOut(callSid: string | null): Promise<OptOutResult> {
  const supabase = db();
  if (!supabase || !callSid) return "unavailable";

  try {
    const { data, error } = await supabase
      .from("call_tasks")
      .select("client_id")
      .eq("call_sid", callSid)
      .maybeSingle();

    if (error) {
      console.error("[voice-outbound] could not resolve the opt-out's client:", error.message);
      return "unavailable";
    }

    const clientId = (data as { client_id?: string | null } | null)?.client_id ?? null;
    // A dictated errand to someone with no client row has nowhere to hang the
    // flag. Ana must not claim to have done something there is no record of.
    if (!clientId) return "no_contact";

    const { error: writeError } = await supabase
      .from("clients")
      .update({ do_not_call: true })
      .eq("id", clientId);

    if (writeError) {
      console.error("[voice-outbound] could not record the opt-out:", writeError.message);
      return "unavailable";
    }

    console.info("[voice-outbound] opt-out recorded live, mid-call", { callSid, clientId });
    return "recorded";
  } catch (err) {
    console.error("[voice-outbound] opt-out write threw:", err);
    return "unavailable";
  }
}

/**
 * The whole turn, fixed.
 *
 * Not generated, because B6 is the one branch where the model's judgement is a
 * liability: apologise, state what has been done, wish them a good day, end.
 * No defence, no "but", no asking why, no last attempt at the errand, no offer
 * of another channel.
 *
 * The `recorded` variant is the only one that promises anything, and it is only
 * reachable after the write returned. When the write did not land Ana says the
 * honest thing instead — the same discipline as capture_task telling the owner
 * plainly when a note was not saved. Claiming an opt-out that is not in the
 * database is precisely the failure this whole path exists to prevent.
 */
export function optOutLine(locale: "fr" | "en", result: OptOutResult): string {
  if (result === "recorded") {
    return locale === "fr"
      ? "Je m'excuse de vous avoir dérangé. Je vous retire de la liste tout de suite, vous ne recevrez plus d'appels de notre part. Bonne journée."
      : "I'm sorry to have bothered you. I'm taking you off the list right now, you won't be getting any more calls from us. Have a good day.";
  }

  return locale === "fr"
    ? "Je m'excuse de vous avoir dérangé. Je transmets votre demande à l'équipe aujourd'hui même pour qu'on arrête de vous appeler. Bonne journée."
    : "I'm sorry to have bothered you. I'm passing your request to the team today so we stop calling you. Have a good day.";
}
