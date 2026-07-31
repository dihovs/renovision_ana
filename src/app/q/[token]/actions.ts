"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
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

export async function approveAction(
  token: string,
  _prev: ApprovalState,
  formData: FormData,
): Promise<ApprovalState> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Please type your name to approve." };

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
    if (!quote) return { error: "This quote is no longer open for approval." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not record your approval." };
  }

  revalidatePath(`/q/${token}`);
  return { approved: true };
}

export async function requestChangesAction(
  token: string,
  _prev: ApprovalState,
  formData: FormData,
): Promise<ApprovalState> {
  const message = String(formData.get("message") ?? "").trim();
  if (!message) return { error: "Tell us what you'd like changed." };

  try {
    const ok = await requestChangesByToken(token, message);
    if (!ok) return { error: "This quote is no longer open." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not send your message." };
  }

  revalidatePath(`/q/${token}`);
  return { sent: true };
}
