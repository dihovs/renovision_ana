import {
  checkSolicitationConsent,
  type ConsentRecord,
  type ConsentVerdict,
} from "./adadConsent";
import { db, isMissingTable } from "./db";

/**
 * Reading and writing the express-consent record (migration 0021).
 *
 * The decision itself lives in adadConsent.ts and is pure. This module only
 * fetches the rows and hands them over, which keeps the rule testable and
 * keeps this file boring.
 *
 * ONE THING HERE IS NOT LIKE THE REST OF THE CODEBASE. Everywhere else, a
 * missing table degrades gracefully: the feature is skipped and the caller is
 * told a migration is pending. This module FAILS CLOSED. If the consent tables
 * do not exist, `consentVerdictFor` refuses the call rather than allowing it.
 *
 * That asymmetry is deliberate and it is the whole point. Everywhere else, the
 * cost of a missing table is a feature that does not work. Here, the cost of
 * treating "I cannot check" as "go ahead" is an unlawful automated call to
 * someone who never agreed to receive one, placed on the owner's phone number,
 * with the onus on him to prove consent he cannot produce. A gate that opens
 * when it cannot see is not a gate.
 */

export type ConsentContext = {
  records: ConsentRecord[];
  onDoNotCallList: boolean;
};

export type ConsentLookup =
  | { ok: true; context: ConsentContext }
  | { ok: false; reason: "unconfigured" | "migration_pending" | "failed"; detail?: string };

const CONSENT_COLUMNS = "phone, purpose, expires_at, withdrawn_at";

/**
 * Everything the gate needs about one number: its consent rows and whether it
 * has asked us to stop.
 *
 * Two queries rather than a join, because they are two tables with two
 * retention obligations and no foreign key between them — a number can be on
 * the do-not-call list having never appeared in the consent table, which is
 * the normal case for someone who asked Ana to stop mid-call.
 */
export async function loadConsentContext(phone: string): Promise<ConsentLookup> {
  const supabase = db();
  if (!supabase) return { ok: false, reason: "unconfigured" };

  const [consents, dnc] = await Promise.all([
    supabase.from("outbound_consents").select(CONSENT_COLUMNS).eq("phone", phone),
    supabase.from("do_not_call_list").select("phone").eq("phone", phone).maybeSingle(),
  ]);

  if (consents.error) {
    if (isMissingTable(consents.error)) return { ok: false, reason: "migration_pending" };
    console.error("[consent] could not read consents:", consents.error.message);
    return { ok: false, reason: "failed", detail: consents.error.message };
  }
  if (dnc.error) {
    if (isMissingTable(dnc.error)) return { ok: false, reason: "migration_pending" };
    console.error("[consent] could not read the do-not-call list:", dnc.error.message);
    return { ok: false, reason: "failed", detail: dnc.error.message };
  }

  return {
    ok: true,
    context: {
      records: (consents.data ?? []) as ConsentRecord[],
      onDoNotCallList: Boolean(dnc.data),
    },
  };
}

export type ConsentGateResult =
  | ConsentVerdict
  | { ok: false; reason: "consent_unavailable"; detail?: string };

/**
 * The gate, ready to be called from anywhere that is about to solicit.
 *
 * Every non-`ok` path is a refusal, including the ones that mean "the database
 * did not answer". See the module header for why that is not over-caution.
 */
export async function consentVerdictFor(
  phone: string,
  now: Date = new Date(),
  purpose = "business_intro",
): Promise<ConsentGateResult> {
  const lookup = await loadConsentContext(phone);
  if (!lookup.ok) {
    const detail =
      lookup.reason === "migration_pending"
        ? "The consent tables do not exist yet — run supabase/migrations/0021_outbound_consent.sql. Until then no introductory call can be placed, which is the correct behaviour."
        : lookup.reason === "unconfigured"
          ? "No database is connected, so consent cannot be verified."
          : (lookup.detail ?? "The consent record could not be read.");
    return { ok: false, reason: "consent_unavailable", detail };
  }

  return checkSolicitationConsent({
    phone,
    purpose,
    records: lookup.context.records,
    onDoNotCallList: lookup.context.onDoNotCallList,
    now,
  });
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export type ConsentWriteResult =
  | { ok: true; id: string }
  | { ok: false; reason: "unconfigured" | "migration_pending" | "failed"; detail?: string };

export type RecordConsentInput = {
  phone: string;
  wording: string;
  channel: "in_person" | "email" | "web_form" | "phone_recorded" | "written";
  contactName?: string | null;
  companyName?: string | null;
  clientId?: string | null;
  evidenceUrl?: string | null;
  evidenceNote?: string | null;
  recordedBy?: string | null;
  expiresAt?: string | null;
};

/**
 * File a consent.
 *
 * `wording` is required and unconstrained on purpose: it is the evidence. The
 * caller passes what the person actually agreed to, verbatim, and this does
 * not normalise, truncate or template it.
 */
export async function recordConsent(input: RecordConsentInput): Promise<ConsentWriteResult> {
  const supabase = db();
  if (!supabase) return { ok: false, reason: "unconfigured" };

  const wording = input.wording.trim();
  if (!wording) {
    return { ok: false, reason: "failed", detail: "The wording they agreed to is required." };
  }

  const { data, error } = await supabase
    .from("outbound_consents")
    .insert({
      phone: input.phone,
      contact_name: input.contactName || null,
      company_name: input.companyName || null,
      client_id: input.clientId || null,
      channel: input.channel,
      wording,
      purpose: "business_intro",
      evidence_url: input.evidenceUrl || null,
      evidence_note: input.evidenceNote || null,
      recorded_by: input.recordedBy || null,
      expires_at: input.expiresAt || null,
    })
    .select("id")
    .single();

  if (error) {
    if (isMissingTable(error)) return { ok: false, reason: "migration_pending" };
    console.error("[consent] could not record consent:", error.message);
    return { ok: false, reason: "failed", detail: error.message };
  }
  return { ok: true, id: data.id as string };
}

/**
 * Withdraw every live consent for a number.
 *
 * Stamped, never deleted. The fact that consent once existed is part of the
 * record we may have to produce, and a withdrawal that erases its own subject
 * evidences nothing.
 */
export async function withdrawConsent(
  phone: string,
  note?: string | null,
): Promise<{ ok: true; changed: number } | { ok: false; reason: string; detail?: string }> {
  const supabase = db();
  if (!supabase) return { ok: false, reason: "unconfigured" };

  const { data, error } = await supabase
    .from("outbound_consents")
    .update({ withdrawn_at: new Date().toISOString(), withdrawn_note: note || null })
    .eq("phone", phone)
    .is("withdrawn_at", null)
    .select("id");

  if (error) {
    if (isMissingTable(error)) return { ok: false, reason: "migration_pending" };
    console.error("[consent] could not withdraw consent:", error.message);
    return { ok: false, reason: "failed", detail: error.message };
  }
  return { ok: true, changed: (data ?? []).length };
}

/**
 * Add a number to the internal do-not-call list.
 *
 * Idempotent by primary key: asking twice is not an error, and the FIRST
 * request is the one that counts — both the 14-day deadline to add it and the
 * three-year retention run from when they asked, so a later duplicate must not
 * overwrite `requested_at` and quietly restart the clock.
 */
export async function addToDoNotCallList(input: {
  phone: string;
  requestedAt?: Date | string | null;
  source?: string;
  note?: string | null;
}): Promise<{ ok: true } | { ok: false; reason: string; detail?: string }> {
  const supabase = db();
  if (!supabase) return { ok: false, reason: "unconfigured" };

  const requestedAt =
    input.requestedAt instanceof Date
      ? input.requestedAt.toISOString()
      : input.requestedAt || new Date().toISOString();

  const { error } = await supabase.from("do_not_call_list").upsert(
    {
      phone: input.phone,
      requested_at: requestedAt,
      source: input.source ?? "call",
      note: input.note || null,
    },
    { onConflict: "phone", ignoreDuplicates: true },
  );

  if (error) {
    if (isMissingTable(error)) return { ok: false, reason: "migration_pending" };
    console.error("[consent] could not add to the do-not-call list:", error.message);
    return { ok: false, reason: "failed", detail: error.message };
  }
  return { ok: true };
}

/** One row of public.outbound_consents, column for column. */
export type ConsentRow = ConsentRecord & {
  id: string;
  created_at: string;
  contact_name: string | null;
  company_name: string | null;
  client_id: string | null;
  channel: string;
  wording: string;
  evidence_url: string | null;
  evidence_note: string | null;
  recorded_by: string | null;
  withdrawn_note: string | null;
};

export type ConsentListResult =
  | { ok: true; rows: ConsentRow[]; doNotCall: string[] }
  | { ok: false; reason: "unconfigured" | "migration_pending" | "failed"; detail?: string };

/**
 * Everything on file for the outreach screen, newest first, with the
 * do-not-call numbers alongside.
 *
 * The two are fetched together because the screen has to show them together:
 * a consent row for a number that later asked us to stop still exists, and
 * displaying it without that fact would show a green light on a call that
 * would be refused.
 */
export async function listConsents(limit = 200): Promise<ConsentListResult> {
  const supabase = db();
  if (!supabase) return { ok: false, reason: "unconfigured" };

  const [consents, dnc] = await Promise.all([
    supabase
      .from("outbound_consents")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase.from("do_not_call_list").select("phone"),
  ]);

  if (consents.error) {
    if (isMissingTable(consents.error)) return { ok: false, reason: "migration_pending" };
    console.error("[consent] could not list consents:", consents.error.message);
    return { ok: false, reason: "failed", detail: consents.error.message };
  }
  if (dnc.error) {
    if (isMissingTable(dnc.error)) return { ok: false, reason: "migration_pending" };
    console.error("[consent] could not list the do-not-call numbers:", dnc.error.message);
    return { ok: false, reason: "failed", detail: dnc.error.message };
  }

  return {
    ok: true,
    rows: (consents.data ?? []) as ConsentRow[],
    doNotCall: ((dnc.data ?? []) as Array<{ phone: string }>).map((row) => row.phone),
  };
}
