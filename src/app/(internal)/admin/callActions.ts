"use server";

import { isSignedIn } from "@/lib/adminAuth";
import { bridgeCall, ownerMobile } from "@/lib/voice/bridge";

/**
 * Placing a call from the business number, on the owner's behalf.
 *
 * Its own file rather than a function in clients/actions.ts because the button
 * is mounted anywhere a phone number appears — a client, a lead, the dialer on
 * the Calls page — and hanging a shared action off one screen's module makes
 * every other screen import that screen.
 *
 * Returns a sentence instead of throwing, for the reason taskBarActions.ts
 * gives: this control sits beside whatever he was doing, and a thrown error
 * would replace that work with an error boundary. Authorisation is the one
 * exception and does throw — a signed-out caller reaching this is not a state
 * worth rendering.
 */
export async function bridgeCallAction(phone: string): Promise<string | null> {
  if (!(await isSignedIn())) throw new Error("Not authorised");

  const result = await bridgeCall({ to: phone });
  if (result.ok) return null;

  switch (result.reason) {
    case "no_owner_number":
      return "Set OWNER_PHONE_NUMBERS (or OWNER_MOBILE) so we know which phone to ring.";
    case "invalid_number":
      return result.detail ?? "That does not look like a number we can dial.";
    case "not_configured":
      return "Calling out is not switched on yet — TWILIO_ACCOUNT_SID is missing.";
    default:
      return result.detail ?? "The call did not go through. Try again in a moment.";
  }
}

/** Which phone will ring, so the button can say so before he presses it. */
export async function ownerMobileAction(): Promise<string | null> {
  if (!(await isSignedIn())) throw new Error("Not authorised");
  return ownerMobile();
}
