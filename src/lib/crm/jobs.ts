import type { SupabaseClient } from "@supabase/supabase-js";
import { db, isMissingTable, MigrationPendingError } from "./db";
import { calculateQuoteTotals } from "./money";
import type {
  ChecklistItem,
  DocumentLine,
  Job,
  JobRecurrence,
  JobStatus,
  JobWithLines,
  RecurrenceFrequency,
  Visit,
} from "./opsTypes";
import { lineForTotals, priced } from "./opsTypes";
import { generateOccurrences } from "./recurrence";
import { getQuote, resolveQuoteTaxRateForQuote } from "./quotes";
import { clientDisplayName } from "./types";

/**
 * Jobs and visits.
 *
 * A job is created from an approved quote and COPIES its lines rather than
 * pointing at them. The quote is an offer that was accepted at a moment in
 * time; the job is what is actually being built. Letting a later quote edit
 * reach into a running job is how a crew ends up installing something nobody
 * agreed to pay for.
 */

function requireDb() {
  const client = db();
  if (!client) throw new Error("Database is not configured");
  return client;
}

function orNull(value: string | undefined | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export type JobListItem = Job & { client_name: string; visit_count: number };

export async function listJobs(
  options: { status?: JobStatus; clientId?: string; limit?: number } = {},
): Promise<JobListItem[]> {
  const client = requireDb();
  const { status, clientId, limit = 200 } = options;

  let query = client
    .from("jobs")
    .select("*, clients(first_name, last_name, company_name), visits(id)")
    .is("archived_at", null)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (status) query = query.eq("status", status);
  if (clientId) query = query.eq("client_id", clientId);

  const { data, error } = await query;
  if (error) {
    if (isMissingTable(error)) throw new MigrationPendingError("jobs");
    throw new Error(`Could not load jobs: ${error.message}`);
  }

  return ((data ?? []) as (Job & {
    clients: Parameters<typeof clientDisplayName>[0] | null;
    visits: { id: string }[];
  })[]).map(({ clients, visits, ...job }) => ({
    ...job,
    client_name: clients ? clientDisplayName(clients) : "Unknown client",
    visit_count: visits?.length ?? 0,
  }));
}

export async function getJob(id: string): Promise<JobWithLines | null> {
  const client = requireDb();
  const { data, error } = await client
    .from("jobs")
    .select("*, job_line_items(*), visits(*)")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    if (isMissingTable(error)) throw new MigrationPendingError("jobs");
    throw new Error(`Could not load the job: ${error.message}`);
  }
  if (!data) return null;

  const row = data as Job & { job_line_items: DocumentLine[]; visits: Visit[] };
  return {
    ...row,
    lines: (row.job_line_items ?? []).sort((a, b) => a.position - b.position),
    visits: (row.visits ?? []).sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
  };
}

/**
 * Turn an approved quote into a job.
 *
 * Only the optional lines the customer actually ticked are copied — an option
 * they declined is not work, and carrying it across "just in case" puts it in
 * front of a crew as if it were agreed.
 *
 * Idempotent: a quote already converted returns its existing job rather than
 * creating a second one, because the convert button is exactly the sort of
 * thing that gets double-tapped on a phone.
 */
export async function createJobFromQuote(quoteId: string): Promise<string> {
  const client = requireDb();

  const existing = await client
    .from("jobs")
    .select("id")
    .eq("quote_id", quoteId)
    .is("archived_at", null)
    .maybeSingle();
  if (existing.data?.id) return existing.data.id as string;

  const quote = await getQuote(quoteId);
  if (!quote) throw new Error("Quote not found");
  if (quote.status !== "approved") {
    throw new Error("Only an approved quote can become a job.");
  }

  const rate = await resolveQuoteTaxRateForQuote(quote);
  const included = quote.lines.filter((line) => line.kind === "text" || !line.optional || line.selected);
  const totals = calculateQuoteTotals(
    priced(included as DocumentLine[]).map(lineForTotals),
    rate,
    { kind: quote.discount_kind, value: quote.discount_value },
  );

  const { data, error } = await client
    .from("jobs")
    .insert({
      client_id: quote.client_id,
      property_id: quote.property_id,
      quote_id: quote.id,
      title: quote.title,
      instructions: quote.client_message,
      internal_notes: quote.internal_notes,
      status: "unscheduled",
      // Copied wholesale: the job must render identically to the quote the
      // customer approved, even if the client record changes tomorrow.
      tax_snapshot: quote.tax_snapshot,
      client_snapshot: quote.client_snapshot,
      property_snapshot: quote.property_snapshot,
      subtotal_cents: totals.subtotalCents,
      discount_cents: totals.discountCents,
      tax_cents: totals.totalTaxCents,
      total_cents: totals.totalCents,
    })
    .select("id")
    .single();

  if (error) {
    if (isMissingTable(error)) throw new MigrationPendingError("jobs");
    throw new Error(`Could not create the job: ${error.message}`);
  }

  const jobId = data.id as string;

  const rows = included.map((line, index) => ({
    job_id: jobId,
    position: index,
    kind: line.kind,
    name: line.name,
    description: line.description,
    quantity_milli: line.quantity_milli,
    unit: line.unit,
    unit_cost_cents: line.unit_cost_cents,
    unit_price_cents: line.unit_price_cents,
    taxable: line.taxable,
    // Resolved at copy time: everything on the job is in scope, so nothing
    // downstream has to re-decide what "optional" meant.
    optional: false,
    selected: false,
    labor_hours: line.labor_hours,
    price_book_item_id: line.price_book_item_id,
  }));

  if (rows.length > 0) {
    const { error: linesError } = await client.from("job_line_items").insert(rows);
    if (linesError) throw new Error(`Could not copy the lines: ${linesError.message}`);
  }

  // Close the loop on the quote so the pipeline reflects reality.
  await client
    .from("quotes")
    .update({ status: "converted", converted_at: new Date().toISOString() })
    .eq("id", quoteId)
    .eq("status", "approved");

  return jobId;
}

export async function updateJob(
  id: string,
  input: {
    title?: string | null;
    instructions?: string | null;
    internalNotes?: string | null;
    status?: JobStatus;
    startsOn?: string | null;
    endsOn?: string | null;
  },
): Promise<void> {
  const client = requireDb();
  const patch: Record<string, unknown> = {};

  if (input.title !== undefined) patch.title = orNull(input.title);
  if (input.instructions !== undefined) patch.instructions = orNull(input.instructions);
  if (input.internalNotes !== undefined) patch.internal_notes = orNull(input.internalNotes);
  if (input.startsOn !== undefined) patch.starts_on = input.startsOn || null;
  if (input.endsOn !== undefined) patch.ends_on = input.endsOn || null;
  if (input.status !== undefined) {
    patch.status = input.status;
    // Recorded once, when the work is first signed off — a later status
    // correction must not move the completion date.
    if (input.status === "complete") patch.completed_at = new Date().toISOString();
  }

  const { error } = await client.from("jobs").update(patch).eq("id", id);
  if (error) throw new Error(`Could not save the job: ${error.message}`);
}

export async function setJobArchived(id: string, archived: boolean): Promise<void> {
  const client = requireDb();
  const { error } = await client
    .from("jobs")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) throw new Error(`Could not archive the job: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Visits
// ---------------------------------------------------------------------------

export async function createVisit(
  jobId: string,
  input: { title?: string | null; startsAt: string; endsAt?: string | null; allDay?: boolean; notes?: string | null },
): Promise<string> {
  const client = requireDb();
  const { data, error } = await client
    .from("visits")
    .insert({
      job_id: jobId,
      title: orNull(input.title),
      starts_at: input.startsAt,
      ends_at: input.endsAt || null,
      all_day: input.allDay ?? false,
      notes: orNull(input.notes),
    })
    .select("id")
    .single();

  if (error) {
    if (isMissingTable(error)) throw new MigrationPendingError("visits");
    throw new Error(`Could not schedule the visit: ${error.message}`);
  }

  // Scheduling something is what makes a job scheduled — leaving it
  // "unscheduled" with a date on the calendar is the sort of inconsistency
  // that makes the whole board untrustworthy.
  await client
    .from("jobs")
    .update({ status: "scheduled" })
    .eq("id", jobId)
    .eq("status", "unscheduled");

  return data.id as string;
}

export async function updateVisit(
  id: string,
  input: { title?: string | null; startsAt?: string; endsAt?: string | null; allDay?: boolean; notes?: string | null; completed?: boolean },
): Promise<void> {
  const client = requireDb();
  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.title = orNull(input.title);
  if (input.startsAt !== undefined) patch.starts_at = input.startsAt;
  if (input.endsAt !== undefined) patch.ends_at = input.endsAt || null;
  if (input.allDay !== undefined) patch.all_day = input.allDay;
  if (input.notes !== undefined) patch.notes = orNull(input.notes);
  if (input.completed !== undefined) {
    patch.completed_at = input.completed ? new Date().toISOString() : null;
  }

  const { error } = await client.from("visits").update(patch).eq("id", id);
  if (error) throw new Error(`Could not save the visit: ${error.message}`);
}

export async function deleteVisit(id: string): Promise<void> {
  const client = requireDb();
  const { error } = await client.from("visits").delete().eq("id", id);
  if (error) throw new Error(`Could not remove the visit: ${error.message}`);
}

export type ScheduledVisit = Visit & {
  job_id: string;
  job_number: number;
  job_title: string | null;
  client_name: string;
  address: string | null;
};

/**
 * Everything on the calendar between two instants.
 *
 * Filtered in the database rather than in memory, because a year-view request
 * would otherwise pull every visit the business has ever had in order to show
 * twelve squares.
 */
export async function listVisitsBetween(fromIso: string, toIso: string): Promise<ScheduledVisit[]> {
  const client = requireDb();
  const { data, error } = await client
    .from("visits")
    .select("*, jobs(id, job_number, title, client_snapshot, property_snapshot)")
    .gte("starts_at", fromIso)
    .lt("starts_at", toIso)
    .order("starts_at", { ascending: true });

  if (error) {
    if (isMissingTable(error)) throw new MigrationPendingError("visits");
    throw new Error(`Could not load the schedule: ${error.message}`);
  }

  return ((data ?? []) as (Visit & {
    jobs: {
      id: string;
      job_number: number;
      title: string | null;
      client_snapshot: { displayName?: string } | null;
      property_snapshot: { street1?: string | null; city?: string | null } | null;
    } | null;
  })[]).map(({ jobs, ...visit }) => ({
    ...visit,
    job_id: jobs?.id ?? visit.job_id,
    job_number: jobs?.job_number ?? 0,
    job_title: jobs?.title ?? null,
    client_name: jobs?.client_snapshot?.displayName ?? "—",
    address:
      [jobs?.property_snapshot?.street1, jobs?.property_snapshot?.city]
        .filter(Boolean)
        .join(", ") || null,
  }));
}

// ---------------------------------------------------------------------------
// Recurrences — the pattern behind generated visits
// ---------------------------------------------------------------------------
//
// A recurrence expands into ORDINARY ROWS in the visits table (tagged with its
// id), so the schedule and everything else keep working untouched. Editing the
// pattern is delete-and-recreate, but only of rows that are (a) tagged as
// generated by this pattern, (b) in the future and (c) never completed —
// manual visits and finished work are never touched.

export type JobExtras = {
  recurrence: JobRecurrence | null;
  checklist: ChecklistItem[];
  /** True when migration 0014 hasn't run — render a notice, hide the features. */
  migrationPending: boolean;
};

/**
 * The recurrence and checklist for one job, degrading gracefully: a database
 * that hasn't run 0014 yet reports `migrationPending` instead of blowing up
 * the whole job screen.
 */
export async function getJobExtras(jobId: string): Promise<JobExtras> {
  const client = requireDb();

  const [rec, items] = await Promise.all([
    client.from("job_recurrences").select("*").eq("job_id", jobId).maybeSingle(),
    client
      .from("job_checklist_items")
      .select("*")
      .eq("job_id", jobId)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);

  if (isMissingTable(rec.error) || isMissingTable(items.error)) {
    return { recurrence: null, checklist: [], migrationPending: true };
  }
  if (rec.error) throw new Error(`Could not load the recurrence: ${rec.error.message}`);
  if (items.error) throw new Error(`Could not load the checklist: ${items.error.message}`);

  return {
    recurrence: (rec.data as JobRecurrence | null) ?? null,
    checklist: (items.data ?? []) as ChecklistItem[],
    migrationPending: false,
  };
}

/**
 * Create or update a job's recurrence, then (re)generate its future visits.
 *
 * The anchor — which weekday, what time, how long — is snapshotted from the
 * job's earliest visit the FIRST time a pattern is saved, and kept on every
 * edit after that. Re-reading it on each edit would make the pattern drift
 * whenever the earliest visit happens to be one the generator itself created.
 *
 * Returns how many visits were written, so the UI can say so.
 */
export async function saveRecurrence(
  jobId: string,
  input: { frequency: RecurrenceFrequency; untilDate: string | null },
): Promise<{ generated: number }> {
  const client = requireDb();

  const existing = await client
    .from("job_recurrences")
    .select("*")
    .eq("job_id", jobId)
    .maybeSingle();
  if (existing.error) {
    if (isMissingTable(existing.error)) throw new MigrationPendingError("job_recurrences");
    throw new Error(`Could not load the recurrence: ${existing.error.message}`);
  }

  let anchor: {
    starts_at: string;
    ends_at: string | null;
    all_day: boolean;
    title: string | null;
  };
  if (existing.data) {
    const prev = existing.data as JobRecurrence;
    anchor = {
      starts_at: prev.anchor_starts_at,
      ends_at: prev.anchor_ends_at,
      all_day: prev.all_day,
      title: prev.visit_title,
    };
  } else {
    const first = await client
      .from("visits")
      .select("starts_at, ends_at, all_day, title")
      .eq("job_id", jobId)
      .order("starts_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (first.error) throw new Error(`Could not read the first visit: ${first.error.message}`);
    if (!first.data) throw new Error("Schedule the first visit before setting the job to repeat.");
    anchor = first.data as typeof anchor;
  }

  const { data, error } = await client
    .from("job_recurrences")
    .upsert(
      {
        job_id: jobId,
        frequency: input.frequency,
        until_date: input.untilDate,
        anchor_starts_at: anchor.starts_at,
        anchor_ends_at: anchor.ends_at,
        all_day: anchor.all_day,
        visit_title: anchor.title,
      },
      { onConflict: "job_id" },
    )
    .select("*")
    .single();
  if (error) throw new Error(`Could not save the recurrence: ${error.message}`);

  // The jobs table already knows the distinction; keep it honest.
  await client.from("jobs").update({ job_type: "recurring" }).eq("id", jobId);

  const generated = await regenerateRecurrenceVisits(client, data as JobRecurrence);
  return { generated };
}

/**
 * Rebuild a pattern's future visits. Idempotent: running it twice in a row
 * produces the same schedule, because everything it inserts is exactly what it
 * just deleted plus whatever the edited pattern says.
 */
async function regenerateRecurrenceVisits(
  client: SupabaseClient,
  rec: JobRecurrence,
): Promise<number> {
  const nowIso = new Date().toISOString();

  // Wipe only what this pattern created and that hasn't happened yet. A
  // completed-early future visit survives, as does anything in the past.
  const wiped = await client
    .from("visits")
    .delete()
    .eq("recurrence_id", rec.id)
    .is("completed_at", null)
    .gt("starts_at", nowIso);
  if (wiped.error) throw new Error(`Could not clear the old visits: ${wiped.error.message}`);

  // Whatever survived must not be double-booked: skip any occurrence landing
  // on an instant a kept generated visit already occupies.
  const kept = await client.from("visits").select("starts_at").eq("recurrence_id", rec.id);
  if (kept.error) throw new Error(`Could not read the remaining visits: ${kept.error.message}`);
  const taken = new Set(
    ((kept.data ?? []) as { starts_at: string }[]).map((v) => new Date(v.starts_at).getTime()),
  );

  const occurrences = generateOccurrences({
    anchorStartsAt: new Date(rec.anchor_starts_at),
    anchorEndsAt: rec.anchor_ends_at ? new Date(rec.anchor_ends_at) : null,
    frequency: rec.frequency,
    untilDate: rec.until_date,
  }).filter((o) => !taken.has(o.startsAt.getTime()));

  if (occurrences.length === 0) return 0;

  const rows = occurrences.map((o) => ({
    job_id: rec.job_id,
    recurrence_id: rec.id,
    title: rec.visit_title,
    starts_at: o.startsAt.toISOString(),
    ends_at: o.endsAt ? o.endsAt.toISOString() : null,
    all_day: rec.all_day,
  }));
  const inserted = await client.from("visits").insert(rows);
  if (inserted.error) throw new Error(`Could not generate the visits: ${inserted.error.message}`);

  // Same rule as createVisit: dates on the calendar make a job scheduled.
  await client
    .from("jobs")
    .update({ status: "scheduled" })
    .eq("id", rec.job_id)
    .eq("status", "unscheduled");

  return rows.length;
}

/**
 * Stop a job repeating: remove the future visits the pattern created, then
 * the pattern itself. Past and completed generated visits stay — the FK sets
 * their recurrence_id to null and they become ordinary history. Idempotent;
 * stopping a job that doesn't repeat is a no-op.
 */
export async function stopRecurrence(jobId: string): Promise<void> {
  const client = requireDb();

  const rec = await client.from("job_recurrences").select("id").eq("job_id", jobId).maybeSingle();
  if (rec.error) {
    if (isMissingTable(rec.error)) throw new MigrationPendingError("job_recurrences");
    throw new Error(`Could not load the recurrence: ${rec.error.message}`);
  }
  if (!rec.data) return;

  const nowIso = new Date().toISOString();
  const wiped = await client
    .from("visits")
    .delete()
    .eq("recurrence_id", rec.data.id as string)
    .is("completed_at", null)
    .gt("starts_at", nowIso);
  if (wiped.error) throw new Error(`Could not remove the upcoming visits: ${wiped.error.message}`);

  const gone = await client.from("job_recurrences").delete().eq("id", rec.data.id as string);
  if (gone.error) throw new Error(`Could not stop the recurrence: ${gone.error.message}`);

  await client.from("jobs").update({ job_type: "one_off" }).eq("id", jobId);
}

// ---------------------------------------------------------------------------
// Checklists
// ---------------------------------------------------------------------------

export async function addChecklistItem(jobId: string, label: string): Promise<void> {
  const client = requireDb();

  // Append at the end. Reads the current max rather than counting rows, so a
  // list with deleted holes keeps appending after the last survivor.
  const last = await client
    .from("job_checklist_items")
    .select("position")
    .eq("job_id", jobId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (last.error) {
    if (isMissingTable(last.error)) throw new MigrationPendingError("job_checklist_items");
    throw new Error(`Could not read the checklist: ${last.error.message}`);
  }

  const position = ((last.data as { position: number } | null)?.position ?? -1) + 1;
  const { error } = await client
    .from("job_checklist_items")
    .insert({ job_id: jobId, label, position });
  if (error) throw new Error(`Could not add the item: ${error.message}`);
}

export async function setChecklistItemDone(id: string, done: boolean): Promise<void> {
  const client = requireDb();
  const { error } = await client.from("job_checklist_items").update({ done }).eq("id", id);
  if (error) throw new Error(`Could not save the item: ${error.message}`);
}

export async function deleteChecklistItem(id: string): Promise<void> {
  const client = requireDb();
  const { error } = await client.from("job_checklist_items").delete().eq("id", id);
  if (error) throw new Error(`Could not remove the item: ${error.message}`);
}

/**
 * Move an item one step up or down.
 *
 * Rebuilds the order in memory and writes back every position that changed —
 * normally the two swapped rows, but also any duplicates left by older writes,
 * so the list self-heals instead of ordering by accident of created_at.
 */
export async function moveChecklistItem(
  jobId: string,
  id: string,
  direction: "up" | "down",
): Promise<void> {
  const client = requireDb();

  const { data, error } = await client
    .from("job_checklist_items")
    .select("id, position")
    .eq("job_id", jobId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Could not read the checklist: ${error.message}`);

  const items = (data ?? []) as { id: string; position: number }[];
  const index = items.findIndex((item) => item.id === id);
  if (index < 0) return;
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= items.length) return;

  [items[index], items[target]] = [items[target], items[index]];

  for (let i = 0; i < items.length; i++) {
    if (items[i].position === i) continue;
    const { error: writeError } = await client
      .from("job_checklist_items")
      .update({ position: i })
      .eq("id", items[i].id);
    if (writeError) throw new Error(`Could not reorder the checklist: ${writeError.message}`);
  }
}

export async function countJobsByStatus(): Promise<Record<string, number>> {
  const client = db();
  if (!client) return {};
  const { data, error } = await client.from("jobs").select("status").is("archived_at", null);
  if (error) return {};
  const counts: Record<string, number> = {};
  for (const row of (data ?? []) as { status: string }[]) {
    counts[row.status] = (counts[row.status] ?? 0) + 1;
  }
  return counts;
}
