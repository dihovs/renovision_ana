import { db } from "@/lib/crm/db";
import { clientDisplayName } from "@/lib/crm/types";

/**
 * Whose number is this?
 *
 * Lifted out of the inbound webhook, unchanged in behaviour, because the
 * question is no longer the webhook's alone: the Messages inbox asks it for
 * every conversation header, and the send action asks it so an outbound text
 * to a number the CRM knows gets filed on the right client.
 *
 * The last ten digits are the discriminating part and the part that survives
 * every way a number gets typed — matching on the full string would miss
 * "(514) 555-0188" against "+15145550188". Same approach as postCallLead.ts's
 * phoneTail.
 *
 * Best-effort by design: every caller treats null as "nobody yet", which is an
 * ordinary answer and not an error. A text from a stranger still has to be
 * stored, shown, and answerable.
 */

export type AttributedClient = { id: string; name: string };

export async function findClientForPhone(phone: string): Promise<AttributedClient | null> {
  const client = db();
  if (!client) return null;

  const tail = phone.replace(/\D/g, "").slice(-10);
  if (tail.length < 10) return null;

  const { data, error } = await client
    .from("clients")
    .select("id, phones, first_name, last_name, company_name")
    .is("archived_at", null)
    .limit(500);
  if (error || !data) return null;

  for (const row of data) {
    const phones = (row.phones ?? []) as Array<{ number?: string }>;
    for (const entry of phones) {
      if ((entry.number ?? "").replace(/\D/g, "").slice(-10) === tail) {
        return { id: row.id as string, name: clientDisplayName(row) };
      }
    }
  }
  return null;
}

/** The webhook's original shape — id or nothing. */
export async function findClientIdForPhone(phone: string): Promise<string | null> {
  return (await findClientForPhone(phone))?.id ?? null;
}
