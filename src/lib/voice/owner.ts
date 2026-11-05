/**
 * Recognising the owner on the phone.
 *
 * Ana normally talks to strangers. When the owner calls he wants the other
 * side of the business — how many leads came in, what's on the schedule, what
 * is owed — and that is company data being read aloud to whoever is holding
 * the phone.
 *
 * ONE FACTOR: the call comes from a number on OWNER_PHONE_NUMBERS.
 *
 * There was a second until 2026-08-05 — a PIN, spoken aloud — and the owner
 * removed it deliberately after living with it. The reason is not laziness: a
 * code said out loud is said in front of whoever is in the room or the truck,
 * and ElevenLabs cannot receive keypad tones (only send them), so "type it
 * instead" was not on the table without rebuilding the inbound call path. He
 * judged a spoken secret to be worth less than the friction it cost. That is
 * his call to make and it is recorded here so nobody quietly "fixes" it back.
 *
 * BE BLUNT ABOUT WHAT THAT COSTS. Caller ID is trivially spoofable, so this is
 * a filter and not proof. More realistically than spoofing: anyone holding his
 * unlocked phone is now the owner as far as Ana is concerned.
 *
 * WHAT KEEPS IT PROPORTIONATE is the boundary that was always the real control,
 * and it has not moved: owner mode is READ access plus taking notes. Nothing in
 * it sends money, deletes a record, emails a customer, or changes the public
 * website — see ownerToolsFor(). The auth is good enough for "read me today's
 * numbers". It is NOT good enough to authorise anything irreversible, and the
 * moment somebody wants to add a tool that spends or destroys, the second
 * factor has to come back with it — through a real channel, not a spoken one.
 *
 * Fails closed: with OWNER_PHONE_NUMBERS unset, owner mode does not exist and
 * Ana behaves like she does for any other caller.
 */

function envList(name: string): string[] {
  return (process.env[name] ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Is this the owner's line?
 *
 * Compared loosely on digits, because the same line shows up as "+15799903077"
 * from Twilio and as "5799903077" or "(579) 990-3077" when a human types it
 * into an env var. Only the last ten digits are compared, so a country-code
 * prefix on one side and not the other doesn't lock the owner out of his own
 * phone system.
 */
export function isOwnerNumber(phone: string | null | undefined): boolean {
  if (!phone) return false;
  const allowed = envList("OWNER_PHONE_NUMBERS");
  if (allowed.length === 0) return false;

  const tail = (value: string) => value.replace(/\D/g, "").slice(-10);
  const callerTail = tail(phone);
  if (callerTail.length < 10) return false;

  return allowed.some((entry) => tail(entry) === callerTail);
}

/** True when owner mode is configured at all. */
export function ownerModeConfigured(): boolean {
  return envList("OWNER_PHONE_NUMBERS").length > 0;
}

/**
 * Owner-mode state for one call.
 *
 * A single field, and deliberately still a type rather than a bare boolean:
 * every tool-gating call site takes an OwnerSession, so if a second factor ever
 * comes back this grows a field instead of rippling a signature change through
 * the route, the tools and their tests.
 */
export type OwnerSession = {
  /** Owner tools are available on this call. */
  authenticated: boolean;
};

/**
 * The admin panel, signed in. The second authenticated owner surface. (ANA-20)
 *
 * WHY THIS IS NOT A HOLE IN THE GATE. `ownerToolsFor()` withholds every tool
 * unless a session says authenticated, and on the phone that word means the
 * caller's number was recognised. This constant asserts the same thing about a
 * different door — and it is legitimate for a reason that has nothing to do
 * with trust and everything to do with arithmetic: whoever holds the admin
 * session cookie can already send an invoice, take a payment, change a status
 * and delete a client, with one click and no model involved. Ana's surface is
 * a strict subset of that, and a draft-only subset at that. Handing it to
 * someone already inside the admin adds no capability; refusing to would only
 * mean the typed box is worse at answering than the telephone.
 *
 * THE OBLIGATION THAT COMES WITH IT: this constant may only be used after an
 * `isSignedIn()` check in the same request. There is exactly one such caller
 * (`/api/admin/assistant`), and `ownerTools.test.ts` asserts that count, so a
 * second one has to be added deliberately rather than by copying an import.
 */
export const ADMIN_OWNER_SESSION: OwnerSession = { authenticated: true };

/** Not the owner. The state every customer call is in. */
export const NO_OWNER_SESSION: OwnerSession = { authenticated: false };

/**
 * Where this call stands.
 *
 * Derived from the caller's number alone now, so it no longer needs the
 * transcript — which also means there is nothing a caller can SAY that changes
 * the answer. That is a genuine improvement on the PIN it replaced: the old
 * version had to read every utterance looking for a code, and "reads what the
 * caller said in order to decide what the caller may see" is the shape of
 * problem worth being rid of.
 */
export function ownerSession(phone: string | null | undefined): OwnerSession {
  return { authenticated: ownerModeConfigured() && isOwnerNumber(phone) };
}
