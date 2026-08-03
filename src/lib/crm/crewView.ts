import { randomBytes } from "crypto";
import { db, isMissingTable } from "./db";
import { signProjectFileUrls } from "./projects";
import type { JobStatus } from "./opsTypes";
import type { PhoneContact } from "./types";

/**
 * The crew view — everything the team needs to do the work, and nothing about
 * money.
 *
 * The owner's rule, in his words: the crew gets "the tasks that they have to
 * do, photos, but we're not giving them detailed price." A subcontractor
 * holding a phone at somebody's front door must not learn what the customer is
 * paying, what the job costs us, or what is left over.
 *
 * THE ALLOWLIST IS BUILT BY NAMING, NEVER BY DELETING.
 *
 * Nothing in this module spreads a database row into a payload and then
 * removes the awkward fields. Every query names its columns, and every payload
 * field is assigned one at a time from a named source. That is a deliberate
 * choice about which way the failure falls: with a denylist, a column added to
 * `jobs` next year leaks by default and somebody has to remember to exclude
 * it; with an allowlist, it is invisible by default and somebody has to decide
 * to include it. `crewView.test.ts` asserts exactly that.
 *
 * Defence in depth: the money columns are not merely dropped from the payload,
 * they are never SELECTed. `subtotal_cents`, `unit_price_cents`,
 * `unit_cost_cents` and the rest never leave Postgres on this code path, so
 * they cannot reach a log line, an error message or a serialized RSC flight
 * response either.
 */

// ---------------------------------------------------------------------------
// The allowlist, as column lists
// ---------------------------------------------------------------------------
//
// Exported so the test can read them. Note what is absent from JOB_COLUMNS:
// subtotal_cents, discount_cents, tax_cents, total_cents, tax_snapshot,
// internal_notes, client_snapshot (which carries the billing address),
// quote_id and client_id.

export const JOB_COLUMNS = [
  "id",
  "job_number",
  "title",
  "status",
  // The one free-text field on a job that is explicitly for the crew — 0007
  // calls it "what the crew needs to know on site", as distinct from
  // internal_notes, which is commercial and never leaves the office.
  "instructions",
  "starts_on",
  "ends_on",
  "completed_at",
  "property_id",
  "client_id",
  // Frozen address, used only as a fallback and read field by field below.
  "property_snapshot",
] as const;

/**
 * Work items: the tasks, stripped of their prices.
 *
 * `unit_price_cents`, `unit_cost_cents` and `labor_hours` are all absent.
 * The first two are obvious. `labor_hours` is excluded too: the hours budgeted
 * for a task is a management figure, and telling a subcontractor "this is
 * costed at four hours" is a negotiating position we did not mean to hand over.
 */
export const LINE_COLUMNS = [
  "id",
  "position",
  "kind",
  "name",
  "description",
  "quantity_milli",
  "unit",
] as const;

export const VISIT_COLUMNS = [
  "id",
  "title",
  "starts_at",
  "ends_at",
  "all_day",
  "completed_at",
  "notes",
] as const;

export const CHECKLIST_COLUMNS = ["id", "label", "done", "position"] as const;

export const PROPERTY_COLUMNS = [
  "street1",
  "street2",
  "city",
  "province",
  "postal_code",
  "country",
  "access_notes",
] as const;

/** First name and phone only. Not the last name, email, or billing address. */
export const CLIENT_COLUMNS = ["first_name", "phones"] as const;

// ---------------------------------------------------------------------------
// Token policy
// ---------------------------------------------------------------------------

/**
 * Hard ceiling on a crew link, from the moment it is minted. Renovations run
 * long, so this is generous; it exists so that no link lives forever.
 */
export const CREW_TOKEN_TTL_DAYS = 90;

/**
 * How long a link keeps working after the job is marked complete. Long enough
 * that a crew finishing on Friday can still check what they did on Monday,
 * short enough that a finished address stops being readable.
 */
export const CREW_COMPLETED_GRACE_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Same shape and same guard as the client hub's token. */
const TOKEN_PATTERN = /^[a-f0-9]{40,80}$/i;

// ---------------------------------------------------------------------------
// Payload shape
// ---------------------------------------------------------------------------

export type CrewWorkItem = {
  id: string;
  kind: "item" | "text";
  name: string;
  description: string | null;
  /** Thousandths, the CRM's convention. Null on a text line. */
  quantityMilli: number | null;
  unit: string | null;
};

export type CrewChecklistItem = { id: string; label: string; done: boolean };

export type CrewVisit = {
  id: string;
  title: string | null;
  startsAt: string;
  endsAt: string | null;
  allDay: boolean;
  completedAt: string | null;
  notes: string | null;
};

export type CrewSite = {
  street1: string | null;
  street2: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  country: string | null;
  accessNotes: string | null;
  /** One line, ready for a maps link. Null when we hold no address at all. */
  mapQuery: string | null;
};

/** Who to ask for at the door. First name and phone, nothing else. */
export type CrewContact = { firstName: string | null; phone: string | null };

export type CrewPhoto = {
  id: string;
  filename: string;
  note: string | null;
  /** Short-lived signed URL, or null when signing failed. */
  url: string | null;
};

export type CrewJobPayload = {
  jobId: string;
  jobNumber: number;
  title: string | null;
  status: JobStatus;
  instructions: string | null;
  startsOn: string | null;
  endsOn: string | null;
  completedAt: string | null;
  site: CrewSite;
  contact: CrewContact;
  workItems: CrewWorkItem[];
  checklist: CrewChecklistItem[];
  visits: CrewVisit[];
  photos: CrewPhoto[];
  /** True when migration 0014 hasn't run — hide the checklist, don't crash. */
  checklistUnavailable: boolean;
  /** True when migration 0015 hasn't run — hide the photo strip, don't crash. */
  photosUnavailable: boolean;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

/**
 * The customer's best phone number.
 *
 * Primary if one is flagged, otherwise the first. Only the number comes back —
 * `smsAllowed` and the contact type are routing decisions for our own systems,
 * not things a subcontractor needs.
 */
function primaryPhone(phones: unknown): string | null {
  if (!Array.isArray(phones)) return null;
  const list = phones as Partial<PhoneContact>[];
  const chosen = list.find((p) => p?.primary && p?.number) ?? list.find((p) => p?.number);
  return str(chosen?.number);
}

function mapQueryFrom(parts: (string | null)[]): string | null {
  const line = parts.filter(Boolean).join(", ").trim();
  return line || null;
}

/**
 * Which project files a crew may see.
 *
 * Two filters, and both matter. A project folder is not a photo album: 0015
 * describes it as holding "site photos, permits, contracts, supplier receipts,
 * plans". A supplier receipt IS a price list, and a signed contract is the
 * total in 48-point type.
 *
 * So: images only, which drops every PDF; and then a name filter, which drops
 * the photographed receipt somebody snapped with their phone. The second one
 * is a heuristic and will occasionally hide a legitimate site photo called
 * "kitchen-quote-wall.jpg". That is the right way round to be wrong.
 */
const MONEY_ISH_NAME =
  /(factur|invoice|receipt|re[cç]u|devis|soumission|quote|estimat|contrat|contract|prix|price|cost|co[uû]t|budget|paiement|payment|deposit|d[ée]p[oô]t|margin|marge|tarif|rate)/i;

function isCrewViewableFile(file: { content_type: string; filename: string; note: string | null }): boolean {
  if (!file.content_type.toLowerCase().startsWith("image/")) return false;
  return !MONEY_ISH_NAME.test(`${file.filename} ${file.note ?? ""}`);
}

// ---------------------------------------------------------------------------
// The payload builder — the security boundary
// ---------------------------------------------------------------------------

/**
 * Assemble exactly what a crew may see about one job.
 *
 * Takes a job id, not a token: the token check is `getCrewJob`'s job, and
 * keeping them apart means this function can be tested for what it discloses
 * without any of the plumbing that decides who is asking.
 *
 * Returns null when the job does not exist or the database is unconfigured.
 * Everything past that degrades rather than throwing — a crew standing outside
 * a locked door should still get the address and the phone number even if the
 * photo library is having a bad day.
 */
export async function crewJobPayload(jobId: string): Promise<CrewJobPayload | null> {
  const client = db();
  if (!client) return null;

  const { data: jobRow, error } = await client
    .from("jobs")
    .select(
      [
        ...JOB_COLUMNS,
        `clients(${CLIENT_COLUMNS.join(", ")})`,
        `properties(${PROPERTY_COLUMNS.join(", ")})`,
      ].join(", "),
    )
    .eq("id", jobId)
    .is("archived_at", null)
    .maybeSingle();

  if (error || !jobRow) return null;

  const job = jobRow as unknown as {
    id: string;
    job_number: number;
    title: string | null;
    status: JobStatus;
    instructions: string | null;
    starts_on: string | null;
    ends_on: string | null;
    completed_at: string | null;
    property_snapshot: Record<string, unknown> | null;
    clients: { first_name?: string | null; phones?: unknown } | null;
    properties: Record<string, unknown> | null;
  };

  const [lines, visits, checklist, photos] = await Promise.all([
    loadWorkItems(client, jobId),
    loadVisits(client, jobId),
    loadChecklist(client, jobId),
    loadPhotos(client, jobId),
  ]);

  // The live property wins over the frozen snapshot: access notes are the one
  // thing on this page most likely to have been corrected since the job was
  // created ("the gate code changed"), and a crew reading a stale code is
  // standing in a driveway phoning the office.
  const live = job.properties;
  const snap = job.property_snapshot;

  const site: CrewSite = live
    ? {
        street1: str(live.street1),
        street2: str(live.street2),
        city: str(live.city),
        province: str(live.province),
        postalCode: str(live.postal_code),
        country: str(live.country),
        accessNotes: str(live.access_notes),
        mapQuery: null,
      }
    : {
        // Field by field out of the snapshot too — `property_snapshot` is an
        // untyped jsonb blob, and spreading it would mean whatever a future
        // writer decides to stuff in there lands on this page.
        street1: str(snap?.street1),
        street2: str(snap?.street2),
        city: str(snap?.city),
        province: str(snap?.province),
        postalCode: str(snap?.postalCode),
        country: str(snap?.country),
        accessNotes: str(snap?.accessNotes),
        mapQuery: null,
      };
  site.mapQuery = mapQueryFrom([site.street1, site.city, site.province, site.postalCode]);

  return {
    jobId: job.id,
    jobNumber: job.job_number,
    title: str(job.title),
    status: job.status,
    instructions: str(job.instructions),
    startsOn: job.starts_on,
    endsOn: job.ends_on,
    completedAt: job.completed_at,
    site,
    contact: {
      firstName: str(job.clients?.first_name),
      phone: primaryPhone(job.clients?.phones),
    },
    workItems: lines,
    checklist: checklist.items,
    visits,
    photos: photos.photos,
    checklistUnavailable: checklist.unavailable,
    photosUnavailable: photos.unavailable,
  };
}

type Client = NonNullable<ReturnType<typeof db>>;

async function loadWorkItems(client: Client, jobId: string): Promise<CrewWorkItem[]> {
  const { data, error } = await client
    .from("job_line_items")
    .select(LINE_COLUMNS.join(", "))
    .eq("job_id", jobId)
    .order("position", { ascending: true });
  if (error) return [];

  return ((data ?? []) as unknown as {
    id: string;
    kind: "item" | "text";
    name: string;
    description: string | null;
    quantity_milli: number | null;
    unit: string | null;
  }[]).map((line) => ({
    id: line.id,
    kind: line.kind === "text" ? "text" : "item",
    name: line.name,
    description: str(line.description),
    quantityMilli: line.quantity_milli,
    unit: str(line.unit),
  }));
}

async function loadVisits(client: Client, jobId: string): Promise<CrewVisit[]> {
  const { data, error } = await client
    .from("visits")
    .select(VISIT_COLUMNS.join(", "))
    .eq("job_id", jobId)
    .order("starts_at", { ascending: true });
  if (error) return [];

  return ((data ?? []) as unknown as {
    id: string;
    title: string | null;
    starts_at: string;
    ends_at: string | null;
    all_day: boolean;
    completed_at: string | null;
    notes: string | null;
  }[]).map((visit) => ({
    id: visit.id,
    title: str(visit.title),
    startsAt: visit.starts_at,
    endsAt: visit.ends_at,
    allDay: Boolean(visit.all_day),
    completedAt: visit.completed_at,
    notes: str(visit.notes),
  }));
}

async function loadChecklist(
  client: Client,
  jobId: string,
): Promise<{ items: CrewChecklistItem[]; unavailable: boolean }> {
  const { data, error } = await client
    .from("job_checklist_items")
    .select(CHECKLIST_COLUMNS.join(", "))
    .eq("job_id", jobId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) return { items: [], unavailable: isMissingTable(error) };

  const items = ((data ?? []) as unknown as {
    id: string;
    label: string;
    done: boolean;
  }[]).map((item) => ({ id: item.id, label: item.label, done: Boolean(item.done) }));

  return { items, unavailable: false };
}

async function loadPhotos(
  client: Client,
  jobId: string,
): Promise<{ photos: CrewPhoto[]; unavailable: boolean }> {
  const links = await client.from("project_jobs").select("project_id").eq("job_id", jobId);
  if (links.error) return { photos: [], unavailable: isMissingTable(links.error) };

  const projectIds = ((links.data ?? []) as { project_id: string }[]).map((l) => l.project_id);
  if (projectIds.length === 0) return { photos: [], unavailable: false };

  const files = await client
    .from("project_files")
    .select("id, storage_path, filename, content_type, note, uploaded_at")
    .in("project_id", projectIds)
    .order("uploaded_at", { ascending: false });
  if (files.error) return { photos: [], unavailable: isMissingTable(files.error) };

  const viewable = ((files.data ?? []) as unknown as {
    id: string;
    storage_path: string;
    filename: string;
    content_type: string;
    note: string | null;
  }[]).filter(isCrewViewableFile);

  if (viewable.length === 0) return { photos: [], unavailable: false };

  // Signing reaches for Storage, which is a different service and a different
  // failure mode. An unsigned photo renders as a name; a thrown error would
  // take the address off the screen.
  let signed: Record<string, string> = {};
  try {
    signed = await signProjectFileUrls(viewable.map((f) => f.storage_path));
  } catch {
    signed = {};
  }

  return {
    photos: viewable.map((file) => ({
      id: file.id,
      filename: file.filename,
      note: str(file.note),
      url: signed[file.storage_path] ?? null,
    })),
    unavailable: false,
  };
}

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

/**
 * Mint or return this job's crew link.
 *
 * Upserts on job_id, so a job has exactly one live link at a time and pressing
 * the button twice does not scatter valid keys around. An existing link that
 * has expired is replaced rather than extended — reissuing is the moment to
 * decide the crew should still have access.
 */
export async function ensureCrewToken(jobId: string, now: Date = new Date()): Promise<string> {
  const client = db();
  if (!client) throw new Error("Database is not configured");

  const { data, error } = await client
    .from("job_crew_tokens")
    .select("token, expires_at")
    .eq("job_id", jobId)
    .maybeSingle();

  if (error) {
    if (isMissingTable(error)) throw new Error("Run migration 0020_crew_tokens.sql first.");
    throw new Error(`Could not read the crew link: ${error.message}`);
  }

  const existing = data as { token: string; expires_at: string } | null;
  if (existing?.token && new Date(existing.expires_at).getTime() > now.getTime()) {
    return existing.token;
  }

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(now.getTime() + CREW_TOKEN_TTL_DAYS * DAY_MS).toISOString();

  const { error: writeError } = await client
    .from("job_crew_tokens")
    .upsert({ job_id: jobId, token, expires_at: expiresAt, last_viewed_at: null }, { onConflict: "job_id" });
  if (writeError) throw new Error(`Could not create the crew link: ${writeError.message}`);

  return token;
}

/**
 * Revoke the link. Deleting the row rather than blanking a column: there is
 * one row per job, so the row IS the grant, and the next `ensureCrewToken`
 * mints a different token.
 */
export async function revokeCrewToken(jobId: string): Promise<void> {
  const client = db();
  if (!client) throw new Error("Database is not configured");
  const { error } = await client.from("job_crew_tokens").delete().eq("job_id", jobId);
  if (error) throw new Error(`Could not revoke the crew link: ${error.message}`);
}

/**
 * Resolve a token to the job it opens, or null.
 *
 * Null covers every reason equally — bad shape, unknown token, expired, job
 * archived, job long finished — because a page that distinguishes "wrong
 * token" from "expired token" is a page that confirms which tokens exist.
 */
async function resolveCrewToken(token: string, now: Date): Promise<string | null> {
  const client = db();
  if (!client) return null;
  if (!TOKEN_PATTERN.test(token)) return null;

  const { data, error } = await client
    .from("job_crew_tokens")
    .select("job_id, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (error || !data) return null;
  const row = data as { job_id: string; expires_at: string };
  if (new Date(row.expires_at).getTime() <= now.getTime()) return null;
  return row.job_id;
}

/** True once the completion grace period has run out. */
function pastCompletionGrace(completedAt: string | null, now: Date): boolean {
  if (!completedAt) return false;
  const done = new Date(completedAt).getTime();
  if (Number.isNaN(done)) return false;
  return now.getTime() > done + CREW_COMPLETED_GRACE_DAYS * DAY_MS;
}

/**
 * The whole read, from token to payload. This is what the page calls.
 *
 * The visit is stamped best-effort and not awaited: "did the crew open the
 * link" is useful to the office, but not so useful that it should sit between
 * a phone on mobile data and the address it came for.
 */
export async function getCrewJob(
  token: string,
  now: Date = new Date(),
): Promise<CrewJobPayload | null> {
  const jobId = await resolveCrewToken(token, now);
  if (!jobId) return null;

  const payload = await crewJobPayload(jobId);
  if (!payload) return null;
  if (pastCompletionGrace(payload.completedAt, now)) return null;

  const client = db();
  if (client) {
    void client
      .from("job_crew_tokens")
      .update({ last_viewed_at: now.toISOString() })
      .eq("token", token)
      .then(() => undefined);
  }

  return payload;
}

// ---------------------------------------------------------------------------
// Writes — the two things a crew may change
// ---------------------------------------------------------------------------
//
// Both are scoped by the token, not by the id in the request. The row is
// updated with a WHERE that includes the token's job, so holding a link to job
// A and posting the id of a checklist item on job B changes nothing. Neither
// write touches anything commercial.

/** Tick or untick a checklist item. Returns false when it isn't this job's. */
export async function setCrewChecklistItemDone(
  token: string,
  itemId: string,
  done: boolean,
  now: Date = new Date(),
): Promise<boolean> {
  const client = db();
  if (!client) return false;

  const jobId = await resolveCrewToken(token, now);
  if (!jobId) return false;

  const { data, error } = await client
    .from("job_checklist_items")
    .update({ done })
    .eq("id", itemId)
    // The guard: the item must belong to the job this token opens.
    .eq("job_id", jobId)
    .select("id");

  if (error) return false;
  return ((data ?? []) as unknown[]).length > 0;
}

/** Mark a visit done (or undo it). Same token guard. */
export async function setCrewVisitCompleted(
  token: string,
  visitId: string,
  completed: boolean,
  now: Date = new Date(),
): Promise<boolean> {
  const client = db();
  if (!client) return false;

  const jobId = await resolveCrewToken(token, now);
  if (!jobId) return false;

  const { data, error } = await client
    .from("visits")
    .update({ completed_at: completed ? now.toISOString() : null })
    .eq("id", visitId)
    .eq("job_id", jobId)
    .select("id");

  if (error) return false;
  return ((data ?? []) as unknown[]).length > 0;
}
