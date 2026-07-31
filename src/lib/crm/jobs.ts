import { db, isMissingTable, MigrationPendingError } from "./db";
import { calculateQuoteTotals } from "./money";
import type { DocumentLine, Job, JobStatus, JobWithLines, Visit } from "./opsTypes";
import { lineForTotals, priced } from "./opsTypes";
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
