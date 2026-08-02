import { db, isMissingTable, MigrationPendingError } from "./db";
import type { ProjectBrief } from "@/lib/projectBrief";

/**
 * Call transcripts.
 *
 * Text only, never audio — see the migration for why. Everything here is
 * written from the Twilio webhook path, which means it runs while a customer is
 * on the phone: every function fails soft rather than throwing, because losing
 * a transcript row is a bad afternoon and dropping a live call is a lost job.
 */

export type CallTurn = {
  role: "caller" | "agent";
  text: string;
  at: string;
  model?: string;
  escalated?: boolean;
};

export type StoredCall = {
  id: string;
  created_at: string;
  call_sid: string | null;
  from_number: string | null;
  to_number: string | null;
  status: "in_progress" | "completed" | "failed" | "abandoned";
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  locale: "fr" | "en";
  turns: CallTurn[];
  model: string | null;
  escalated_at: string | null;
  escalation_reason: string | null;
  project_brief: ProjectBrief | null;
  lead_id: string | null;
  transferred_at: string | null;
  notes: string | null;
};

function client() {
  return db();
}

/**
 * Start a call, or return the existing row if Twilio retries the webhook.
 *
 * Twilio retries on timeout, so this must be idempotent on call_sid — a retried
 * webhook that created a second row would split one conversation across two
 * transcripts, each missing half of it.
 */
export async function startCall(input: {
  callSid: string;
  from?: string | null;
  to?: string | null;
  locale?: "fr" | "en";
}): Promise<StoredCall | null> {
  const supabase = client();
  if (!supabase) return null;

  const existing = await supabase
    .from("calls")
    .select("*")
    .eq("call_sid", input.callSid)
    .maybeSingle();
  if (existing.data) return existing.data as StoredCall;

  const { data, error } = await supabase
    .from("calls")
    .insert({
      call_sid: input.callSid,
      from_number: input.from ?? null,
      to_number: input.to ?? null,
      locale: input.locale ?? "fr",
      status: "in_progress",
    })
    .select("*")
    .single();

  if (error) {
    console.error("[calls] could not start:", error.message);
    return null;
  }
  return data as StoredCall;
}

export async function getCallBySid(callSid: string): Promise<StoredCall | null> {
  const supabase = client();
  if (!supabase) return null;
  const { data } = await supabase.from("calls").select("*").eq("call_sid", callSid).maybeSingle();
  return (data as StoredCall) ?? null;
}

/**
 * Append turns to the transcript.
 *
 * Read-modify-write on a jsonb column, which is racy in general — but a phone
 * call is strictly sequential by nature: Twilio will not issue the next turn's
 * webhook until this one has responded, so there is exactly one writer per call
 * at any moment. Worth stating rather than leaving as an accident.
 */
export async function appendTurns(callSid: string, turns: CallTurn[]): Promise<void> {
  const supabase = client();
  if (!supabase || turns.length === 0) return;

  const call = await getCallBySid(callSid);
  if (!call) return;

  const { error } = await supabase
    .from("calls")
    .update({ turns: [...(call.turns ?? []), ...turns] })
    .eq("call_sid", callSid);

  if (error) console.error("[calls] could not append turns:", error.message);
}

export async function markEscalated(callSid: string, reason: string): Promise<void> {
  const supabase = client();
  if (!supabase) return;
  await supabase
    .from("calls")
    .update({ escalated_at: new Date().toISOString(), escalation_reason: reason })
    // Only the first escalation is recorded — the question is "did the cheap
    // model fail", and it can only fail once per call.
    .eq("call_sid", callSid)
    .is("escalated_at", null);
}

export async function setCallLocale(callSid: string, locale: "fr" | "en"): Promise<void> {
  const supabase = client();
  if (!supabase) return;
  await supabase.from("calls").update({ locale }).eq("call_sid", callSid);
}

export async function endCall(
  callSid: string,
  input: {
    status?: StoredCall["status"];
    durationSeconds?: number | null;
    brief?: ProjectBrief | null;
    leadId?: string | null;
    transferred?: boolean;
  } = {},
): Promise<void> {
  const supabase = client();
  if (!supabase) return;

  const patch: Record<string, unknown> = {
    status: input.status ?? "completed",
    ended_at: new Date().toISOString(),
  };
  if (input.durationSeconds != null) patch.duration_seconds = input.durationSeconds;
  if (input.brief !== undefined) patch.project_brief = input.brief;
  if (input.leadId !== undefined) patch.lead_id = input.leadId;
  if (input.transferred) patch.transferred_at = new Date().toISOString();

  const { error } = await supabase.from("calls").update(patch).eq("call_sid", callSid);
  if (error) console.error("[calls] could not end:", error.message);
}

export async function listCalls(limit = 100): Promise<StoredCall[]> {
  const supabase = client();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("calls")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (isMissingTable(error)) throw new MigrationPendingError("calls");
    throw new Error(`Could not load calls: ${error.message}`);
  }
  return (data ?? []) as StoredCall[];
}

/** Just the caller's side, oldest first — what the repeat detector compares. */
export function callerTurns(call: Pick<StoredCall, "turns">): string[] {
  return (call.turns ?? []).filter((t) => t.role === "caller").map((t) => t.text);
}
