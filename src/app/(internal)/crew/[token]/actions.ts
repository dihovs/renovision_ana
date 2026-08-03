"use server";

import { revalidatePath } from "next/cache";
import { setCrewChecklistItemDone, setCrewVisitCompleted } from "@/lib/crm/crewView";

/**
 * The two things a crew may change from a phone.
 *
 * No session — the token in the URL is the credential, exactly as on the
 * public quote page. Server Actions are reachable by direct POST and not only
 * through our own UI, so neither of these trusts anything the page rendered:
 * `setCrewChecklistItemDone` and `setCrewVisitCompleted` re-resolve the token,
 * re-check its expiry, and put the resolved job id in the WHERE clause. Holding
 * a link to job A and posting the id of an item on job B updates nothing.
 *
 * Both writes are also chosen to be harmless. A tick and a "we're done" carry
 * no money, cannot delete anything, and are reversible by the same tap.
 */

/** Tick or untick one checklist item. False means "that wasn't yours". */
export async function toggleChecklistItemAction(
  token: string,
  itemId: string,
  done: boolean,
): Promise<boolean> {
  const ok = await setCrewChecklistItemDone(token, itemId, done);
  if (ok) revalidatePath(`/crew/${token}`);
  return ok;
}

/** Mark a visit finished, or take it back. */
export async function toggleVisitDoneAction(
  token: string,
  visitId: string,
  completed: boolean,
): Promise<boolean> {
  const ok = await setCrewVisitCompleted(token, visitId, completed);
  if (ok) revalidatePath(`/crew/${token}`);
  return ok;
}
