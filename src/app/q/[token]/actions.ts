"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { copyFor, type QuoteLocale } from "@/lib/crm/quoteCopy";
import { approveQuoteByToken, requestChangesByToken } from "@/lib/crm/quotes";

/**
 * Public actions on a quote — no session, the token is the credential.
 *
 * Everything here is reachable by anyone holding the link, so the store
 * functions re-check the quote's status in their WHERE clauses rather than
 * trusting that the page rendered a valid state.
 */

export type ApprovalState = { error?: string; approved?: boolean; sent?: boolean };

/**
 * Best-effort client IP, for the approval record.
 *
 * Behind Vercel, x-forwarded-for is a comma-separated chain and the first
 * entry is the original client. It is evidence of who accepted, not an
 * identity check — a header can be spoofed, and the meaningful record is the
 * name typed plus the timestamp.
 */
async function clientIp(): Promise<string | null> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim().slice(0, 60);
  return h.get("x-real-ip")?.slice(0, 60) ?? null;
}

/**
 * The page renders in whatever language the quote itself was issued in
 * (`quote.language`), and carries that along as a hidden field so the error
 * text a customer sees back matches the document they're reading — a French
 * quote should never bounce back an English validation message.
 */
function localeFrom(formData: FormData): QuoteLocale {
  return formData.get("locale") === "en" ? "en" : "fr";
}

export async function approveAction(
  token: string,
  _prev: ApprovalState,
  formData: FormData,
): Promise<ApprovalState> {
  const t = copyFor(localeFrom(formData));
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: t.nameRequiredError };

  const signature = String(formData.get("signature") ?? "").trim() || null;
  // Checkbox names are prefixed so the ids can't collide with the other fields.
  const selectedLineIds = [...formData.keys()]
    .filter((key) => key.startsWith("line-"))
    .map((key) => key.slice("line-".length));

  const h = await headers();

  try {
    const quote = await approveQuoteByToken(token, {
      name,
      signature,
      ip: await clientIp(),
      userAgent: h.get("user-agent"),
      selectedLineIds,
    });
    if (!quote) return { error: t.noLongerOpenApproval };
  } catch (err) {
    return { error: err instanceof Error ? err.message : t.approvalFailedGeneric };
  }

  revalidatePath(`/q/${token}`);
  return { approved: true };
}

export async function requestChangesAction(
  token: string,
  _prev: ApprovalState,
  formData: FormData,
): Promise<ApprovalState> {
  const t = copyFor(localeFrom(formData));
  const message = String(formData.get("message") ?? "").trim();
  if (!message) return { error: t.messageRequiredError };

  try {
    const ok = await requestChangesByToken(token, message);
    if (!ok) return { error: t.noLongerOpenChanges };
  } catch (err) {
    return { error: err instanceof Error ? err.message : t.changesFailedGeneric };
  }

  revalidatePath(`/q/${token}`);
  return { sent: true };
}
