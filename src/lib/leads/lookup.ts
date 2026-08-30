import { db } from "@/lib/crm/db";
import type { LeadStatusRow } from "./estimateStatus";

/**
 * Find a lead by the number the customer read out.
 *
 * SELECTS THREE COLUMNS AND NO MORE, and that is a security boundary rather
 * than an optimisation. This runs for an unauthenticated voice on a phone line
 * who has offered six digits; the row it reaches holds a name, an address, a
 * phone number and the estimate figures. Fetching the whole row and trusting
 * the caller of this function to use only part of it would put the customer's
 * address one careless template literal away from being read aloud to whoever
 * dialled. So the address never leaves the database.
 *
 * Returns null on a miss AND on an error, deliberately. There is no useful
 * distinction to draw over the phone: Ana asks the caller to repeat the number
 * either way, and a database blip should not produce a different sentence that
 * tells somebody probing the line that the reference was real.
 */
export async function findLeadByReference(reference: string): Promise<LeadStatusRow | null> {
  const client = db();
  if (!client) return null;

  const { data, error } = await client
    .from("leads")
    .select("status, opened_at, created_at")
    .eq("reference", reference)
    .maybeSingle();

  if (error) {
    // A pending migration reads as "not found" to the caller, which is the
    // right behaviour on a live call, but it is a deploy mistake rather than a
    // customer mistake and the log has to say so.
    console.error(`[leads] reference lookup failed: ${error.message}`);
    return null;
  }
  return (data as LeadStatusRow | null) ?? null;
}
