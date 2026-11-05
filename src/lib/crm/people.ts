import { toE164 } from "@/lib/phone";
import { db, isMissingTable } from "./db";

/**
 * One human, however they reach us (migration 0046).
 *
 * A conversation starts in Teams, is followed up by email, and the owner relays
 * it to the crew on WhatsApp. Three identifiers, one person. This module is the
 * join, and everything in Ana's cross-channel work reads through it — see
 * `Docs/Ana-Capabilities-Orders.md`, ANA-02.
 *
 * NOTHING HERE IS FUZZY, AND THAT IS THE POINT. `contactMatch.ts` resolves a
 * spoken NAME and is tuned to fail towards asking, because speech is lossy and
 * a phone hears Tremblay as "Trombley". An email address is not lossy. It
 * either is or is not the one we hold, and a near miss is a different person —
 * so every lookup below is an exact match on a normalised value, and a
 * non-match creates an unlinked person rather than attaching a message to
 * somebody who merely looks similar. Guessing here would file a stranger's
 * words into a customer's history.
 *
 * NORMALISATION HAPPENS ON THE WAY IN, NEVER ON THE WAY OUT. A stored value is
 * already canonical, so a lookup is an index hit rather than a scan, and two
 * spellings of one address cannot become two people. `normaliseIdentity` is
 * pure and is the only implementation — migration 0046 deliberately does NOT
 * reimplement it in SQL, and backfills only the two sources that are already
 * canonical at rest (Meta normalises wa_id; sms_messages.phone has a check
 * constraint). Human-typed client phones come through `backfillClientPhones`
 * below, which uses the same `toE164` the dialler does.
 *
 * MIGRATIONS HERE ARE RUN BY HAND. Until the owner runs 0046 these tables do
 * not exist, and this module reports that rather than throwing — the same rule
 * `tasks.ts` follows, for the same reason: a missing table must cost the
 * feature, never the phone call.
 */

/**
 * The five ways a human currently arrives.
 *
 * `phone` and `whatsapp_wa_id` are separate kinds for the same digits because
 * Meta's id has no plus, and treating the two as interchangeable by eye is how
 * a join silently returns nothing. Both are written for a WhatsApp contact, so
 * either lookup finds the person.
 */
export type IdentityKind = "email" | "phone" | "teams_user_id" | "whatsapp_wa_id" | "ms_upn";

export type Person = {
  id: string;
  display_name: string | null;
  client_id: string | null;
  notes: string | null;
};

/** Same three-way outcome `tasks.ts` uses, and for the same three sentences. */
export type PeopleFailure = {
  ok: false;
  reason: "unconfigured" | "migration_pending" | "failed";
  detail?: string;
};

/**
 * `person: null` means "nobody has this identifier", which is an ordinary
 * answer and not an error — a text arrives from an unknown number every week.
 * It is kept distinct from the failures above so "we do not know them" and "we
 * could not look" never read the same.
 */
export type PersonLookup = { ok: true; person: Person | null } | PeopleFailure;

export type PersonResult = { ok: true; person: Person; created: boolean } | PeopleFailure;

const COLUMNS = "id, display_name, client_id, notes";

/**
 * An identifier reduced to the one spelling we store, or null if it is not a
 * usable one of its kind.
 *
 * Pure, so it can be tested against hand-written values without a database —
 * the same split `contactMatch.ts` makes between `rankMatches` and
 * `resolveContact`, and for the same reason: the deciding is what is worth
 * testing.
 *
 * Null is a real answer. A malformed address must not become an identity that
 * silently matches nothing forever.
 */
export function normaliseIdentity(kind: IdentityKind, raw: string | null | undefined): string | null {
  if (!raw) return null;
  const text = raw.trim();
  if (!text) return null;

  switch (kind) {
    // Addresses and Entra sign-in names are case-insensitive in practice, so
    // they are lowercased. No further validation than "looks like an address":
    // rejecting unusual but legal addresses would lose real mail.
    case "email":
    case "ms_upn": {
      const value = text.toLowerCase();
      if (/\s/.test(value)) return null;
      const at = value.indexOf("@");
      if (at <= 0 || at !== value.lastIndexOf("@")) return null;
      if (at === value.length - 1) return null;
      return value;
    }

    // The dialler's normaliser, not a second one. It rejects extensions and
    // +1055-style typos; see src/lib/phone.ts for why each rule is there.
    case "phone":
      return toE164(text);

    // Meta's id: E.164 with the plus stripped. Accepting a leading plus and
    // removing it is a kindness to callers holding the number in either shape;
    // anything else non-numeric is a different sort of value and refused.
    case "whatsapp_wa_id": {
      const digits = text.startsWith("+") ? text.slice(1) : text;
      return /^[1-9][0-9]{7,14}$/.test(digits) ? digits : null;
    }

    // An Entra object id — a GUID. Lowercased because Microsoft returns it in
    // either case and two casings must not become two people.
    case "teams_user_id": {
      const value = text.toLowerCase();
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value)
        ? value
        : null;
    }
  }
}

function failureFor(error: { message: string }, what: string): PeopleFailure {
  if (isMissingTable(error)) {
    console.warn(`[people] ${what} — run supabase/migrations/0046_people_identities.sql`);
    return { ok: false, reason: "migration_pending" };
  }
  console.error(`[people] ${what}:`, error.message);
  return { ok: false, reason: "failed", detail: error.message };
}

/**
 * Who owns this identifier, if anyone.
 *
 * Exact match on the normalised value. An identifier that does not normalise is
 * not a lookup that fails — it is a question that cannot be asked, and saying
 * so beats returning "nobody" and letting the caller conclude the person is new.
 */
export async function resolvePerson(kind: IdentityKind, raw: string): Promise<PersonLookup> {
  const supabase = db();
  if (!supabase) return { ok: false, reason: "unconfigured" };

  const value = normaliseIdentity(kind, raw);
  if (!value) return { ok: false, reason: "failed", detail: `not a usable ${kind}` };

  const { data, error } = await supabase
    .from("person_identities")
    .select(`person_id, people!inner (${COLUMNS})`)
    .eq("kind", kind)
    .eq("value", value)
    .maybeSingle();

  if (error) return failureFor(error, "could not resolve an identity");
  if (!data) return { ok: true, person: null };

  // Supabase types an embedded row as an array or an object depending on the
  // relationship it infers; `!inner` gives one row either way.
  const embedded = (data as { people: Person | Person[] }).people;
  const person = Array.isArray(embedded) ? (embedded[0] ?? null) : embedded;
  return { ok: true, person };
}

/**
 * Attach an identifier to a person.
 *
 * A value already claimed by somebody else is left alone rather than moved. One
 * identifier belongs to one person (the unique constraint in 0046 says so), and
 * quietly reassigning it would merge two people's histories on the strength of
 * a typo somewhere upstream. The caller is told nothing changed and a human
 * decides.
 */
export async function linkIdentity(
  personId: string,
  kind: IdentityKind,
  raw: string,
  source: string,
): Promise<{ ok: true; linked: boolean } | PeopleFailure> {
  const supabase = db();
  if (!supabase) return { ok: false, reason: "unconfigured" };

  const value = normaliseIdentity(kind, raw);
  if (!value) return { ok: false, reason: "failed", detail: `not a usable ${kind}` };

  const { error } = await supabase
    .from("person_identities")
    .insert({ person_id: personId, kind, value, source })
    .select("id")
    .maybeSingle();

  if (!error) return { ok: true, linked: true };
  // 23505 is a unique violation: somebody already has it, including possibly
  // this same person. Not an error worth a red line in the log.
  if ((error as { code?: string }).code === "23505") return { ok: true, linked: false };
  return failureFor(error, "could not link an identity");
}

/**
 * The person behind an identifier, creating one if this is the first time we
 * have seen it.
 *
 * The create-if-absent is what lets an inbound message always be filed against
 * somebody, so nothing has to be dropped for arriving from a stranger. The new
 * person has no client and usually no name — that is honest, and the admin can
 * say who they are later.
 */
export async function personForIdentity(
  kind: IdentityKind,
  raw: string,
  options: { displayName?: string | null; source: string },
): Promise<PersonResult> {
  const found = await resolvePerson(kind, raw);
  if (!found.ok) return found;
  if (found.person) {
    return { ok: true, person: found.person, created: false };
  }

  const supabase = db();
  if (!supabase) return { ok: false, reason: "unconfigured" };

  const { data, error } = await supabase
    .from("people")
    .insert({ display_name: options.displayName?.trim() || null })
    .select(COLUMNS)
    .single();

  if (error) return failureFor(error, "could not create a person");

  const person = data as Person;
  const linked = await linkIdentity(person.id, kind, raw, options.source);
  if (!linked.ok) return linked;

  // Losing the race is not a failure: somebody else created the person between
  // our lookup and our insert, and theirs is the one that owns the identifier.
  if (!linked.linked) {
    const again = await resolvePerson(kind, raw);
    if (!again.ok) return again;
    if (again.person) return { ok: true, person: again.person, created: false };
  }

  return { ok: true, person, created: true };
}

/**
 * Client phone numbers, normalised into identities.
 *
 * Migration 0046 backfills everything that is already canonical at rest and
 * deliberately stops here, because `clients.phones` holds whatever a human
 * typed and turning that into E.164 is `toE164` — which rejects extensions and
 * +1055-style typos for reasons worth a paragraph in src/lib/phone.ts. A second
 * normaliser written in SQL would agree with it right up until it didn't.
 *
 * Safe to run more than once: an identifier already claimed is skipped.
 */
export async function backfillClientPhones(): Promise<
  { ok: true; linked: number; skipped: number } | PeopleFailure
> {
  const supabase = db();
  if (!supabase) return { ok: false, reason: "unconfigured" };

  const { data, error } = await supabase.from("people").select("id, client_id").not("client_id", "is", null);
  if (error) return failureFor(error, "could not read people");

  const people = (data ?? []) as { id: string; client_id: string }[];
  if (people.length === 0) return { ok: true, linked: 0, skipped: 0 };

  const { data: clientRows, error: clientError } = await supabase
    .from("clients")
    .select("id, phones")
    .in("id", people.map((p) => p.client_id));
  if (clientError) return failureFor(clientError, "could not read client phones");

  const phonesByClient = new Map<string, { number?: string }[]>();
  for (const row of (clientRows ?? []) as { id: string; phones: { number?: string }[] }[]) {
    phonesByClient.set(row.id, Array.isArray(row.phones) ? row.phones : []);
  }

  let linked = 0;
  let skipped = 0;
  for (const person of people) {
    for (const phone of phonesByClient.get(person.client_id) ?? []) {
      const value = normaliseIdentity("phone", phone.number);
      if (!value) {
        skipped += 1;
        continue;
      }
      const result = await linkIdentity(person.id, "phone", value, "clients.phones");
      if (!result.ok) return result;
      if (result.linked) linked += 1;
      else skipped += 1;
    }
  }

  return { ok: true, linked, skipped };
}
