"use server";

import { revalidatePath } from "next/cache";
import { isSignedIn } from "@/lib/adminAuth";
import { CONSENT_REFUSAL_MESSAGE } from "@/lib/crm/adadConsent";
import { toE164 } from "@/lib/crm/callScheduler";
import { queueCallTask } from "@/lib/crm/callTasks";
import {
  addToDoNotCallList,
  consentVerdictFor,
  recordConsent,
  withdrawConsent,
} from "@/lib/crm/consentStore";

/**
 * The outreach screen's mutations.
 *
 * Everything here returns its outcome rather than throwing, because every
 * outcome on this screen is something the office has to read and act on — a
 * refusal is the normal case, not an exception.
 *
 * None of these actions is the compliance control. The control is in
 * `queueCallTask`, which refuses a soliciting kind without live consent no
 * matter who calls it. This file is a UI in front of that, and it is written
 * so that the UI and the gate cannot drift: it does not decide anything, it
 * reports what the gate said.
 */

async function requireSession(): Promise<void> {
  if (!(await isSignedIn())) throw new Error("Not authorised");
}

export type OutreachResult = { ok: true; message: string } | { ok: false; message: string };

function refresh(): void {
  revalidatePath("/admin/outreach");
  revalidatePath("/admin/tasks");
}

/**
 * File a consent someone gave.
 *
 * Note what this does NOT do: it does not present a checkbox to the person
 * being called, and it never could — they are not at a screen. What is being
 * recorded is the owner's attestation that consent was obtained, together with
 * the evidence. The UTRs accept that ("consent through other methods as long
 * as a documented record of consumer consent is created"), and it is why the
 * wording and the evidence fields are required rather than decorative: the
 * onus to demonstrate valid consent is ours.
 */
export async function recordConsentAction(formData: FormData): Promise<OutreachResult> {
  await requireSession();

  const phone = toE164(String(formData.get("phone") ?? ""));
  if (!phone) {
    return { ok: false, message: "That does not look like a phone number we can dial." };
  }

  const wording = String(formData.get("wording") ?? "").trim();
  if (!wording) {
    return {
      ok: false,
      message:
        "Write down what they actually agreed to, in their words or yours. That sentence is the evidence — without it the record proves nothing.",
    };
  }

  const channel = String(formData.get("channel") ?? "");
  const allowed = ["in_person", "email", "web_form", "phone_recorded", "written"];
  if (!allowed.includes(channel)) {
    return { ok: false, message: "Pick how the consent was given." };
  }

  const result = await recordConsent({
    phone,
    wording,
    channel: channel as "in_person" | "email" | "web_form" | "phone_recorded" | "written",
    contactName: String(formData.get("contactName") ?? "").trim() || null,
    companyName: String(formData.get("companyName") ?? "").trim() || null,
    evidenceUrl: String(formData.get("evidenceUrl") ?? "").trim() || null,
    evidenceNote: String(formData.get("evidenceNote") ?? "").trim() || null,
    recordedBy: String(formData.get("recordedBy") ?? "").trim() || null,
    expiresAt: String(formData.get("expiresAt") ?? "").trim() || null,
  });

  if (!result.ok) {
    if (result.reason === "migration_pending") {
      return {
        ok: false,
        message:
          "The consent table doesn't exist yet — run supabase/migrations/0021_outbound_consent.sql. Nothing was saved.",
      };
    }
    if (result.reason === "unconfigured") {
      return { ok: false, message: "No database is connected, so nothing was saved." };
    }
    return { ok: false, message: result.detail ?? "The database refused the record." };
  }

  refresh();
  return { ok: true, message: `Consent recorded for ${phone}.` };
}

/** Withdraw consent. Stamped, never deleted — the record has to survive it. */
export async function withdrawConsentAction(phone: string): Promise<OutreachResult> {
  await requireSession();

  const result = await withdrawConsent(phone, "withdrawn from the outreach screen");
  if (!result.ok) {
    return { ok: false, message: `Not withdrawn: ${result.detail ?? result.reason}` };
  }
  if (result.changed === 0) {
    return { ok: false, message: "There was nothing live to withdraw for that number." };
  }

  refresh();
  return {
    ok: true,
    message: `Consent withdrawn for ${phone}. No automated call will go to it again.`,
  };
}

/**
 * Add a number to the internal do-not-call list.
 *
 * Separate from withdrawing consent, and both are usually right at once: a
 * withdrawal ends the authorisation, and the do-not-call entry is the thing
 * that has to be kept for three years and fourteen days from the request. The
 * screen does both from one button for that reason.
 */
export async function suppressNumberAction(
  phone: string,
  note?: string | null,
): Promise<OutreachResult> {
  await requireSession();

  const normalized = toE164(phone);
  if (!normalized) return { ok: false, message: "That does not look like a phone number." };

  const listed = await addToDoNotCallList({ phone: normalized, source: "manual", note });
  if (!listed.ok) {
    return { ok: false, message: `Not added: ${listed.detail ?? listed.reason}` };
  }
  // Withdrawing too, because leaving a live consent row next to a do-not-call
  // entry is a contradiction someone will eventually resolve the wrong way.
  await withdrawConsent(normalized, "number added to the do-not-call list");

  refresh();
  return {
    ok: true,
    message: `${normalized} is on the do-not-call list. Nothing automated goes to it, and the entry stays for three years from today.`,
  };
}

/**
 * Queue the introductory call.
 *
 * The consent is checked here so the message on screen is specific, and again
 * inside `queueCallTask`, and a third time by the dialer at the moment of
 * dialling. That is not paranoia about the same fact: the three checks happen
 * at three different times, and consent can change between any two of them.
 */
export async function queueIntroCallAction(input: {
  phone: string;
  contactName?: string | null;
  companyName?: string | null;
  consentReminder?: string | null;
  locale?: "fr" | "en";
}): Promise<OutreachResult> {
  await requireSession();

  const phone = toE164(input.phone);
  if (!phone) return { ok: false, message: "That does not look like a phone number we can dial." };

  const verdict = await consentVerdictFor(phone);
  if (!verdict.ok) {
    return {
      ok: false,
      message:
        verdict.reason === "consent_unavailable"
          ? (verdict.detail ?? "Consent could not be verified, so the call was not queued.")
          : CONSENT_REFUSAL_MESSAGE[verdict.reason],
    };
  }

  const queued = await queueCallTask({
    kind: "business_intro",
    toNumber: phone,
    locale: input.locale ?? "fr",
    payload: {
      contact_name: input.contactName || null,
      company: input.companyName || null,
      consent_reminder: input.consentReminder || null,
      source: "outreach_screen",
    },
    // One attempt. An introduction that reaches voicemail has been made; ringing
    // a stranger three times to introduce yourself is the behaviour the whole
    // consent regime exists to discourage.
    maxAttempts: 1,
  });

  if (!queued.ok) {
    if (queued.reason === "duplicate") {
      return {
        ok: false,
        message:
          "This number has already had an introductory call. There is only ever one — a second automated introduction is a call you should make yourself.",
      };
    }
    if (queued.reason === "no_consent") {
      return { ok: false, message: queued.detail ?? "No consent on file." };
    }
    if (queued.reason === "migration_pending") {
      return {
        ok: false,
        message:
          "The call queue or the consent tables are missing — run migrations 0018 and 0021. Nothing was queued.",
      };
    }
    return { ok: false, message: queued.detail ?? "The call could not be queued." };
  }

  refresh();
  return {
    ok: true,
    message: `Queued. It goes out in the next calling window, once, and you can stop it from the Tasks screen until it does.`,
  };
}
