import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isDuplicateKey,
  nextWorkingDayWindow,
  refuse,
  type ConversionResult,
} from "./conversions";
import { db, isMissingTable, MigrationPendingError } from "./db";
import { calculateQuoteTotals } from "./money";
import { attachJob } from "./projects";
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
import { QUOTE_STATUS_LABEL } from "./quoteTypes";
import { generateOccurrences } from "./recurrence";
import { getQuote, resolveQuoteTaxRateForQuote } from "./quotes";
import { canChargeTax, getCompany, getTaxRates, resolveTaxRate, type TaxRate } from "./settings";
import { loadDocumentSnapshots } from "./snapshots";
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

export type JobListItem = Job & {
  client_name: string;
  visit_count: number;
  message_count: number;
  photo_count: number;
};

export async function listJobs(
  options: { status?: JobStatus; clientId?: string; limit?: number } = {},
): Promise<JobListItem[]> {
  const client = requireDb();
  const { status, clientId, limit = 200 } = options;

  let query = client
    .from("jobs")
    .select(
      "*, clients(first_name, last_name, company_name), visits(id), whatsapp_messages(id, media_mime)",
    )
    .is("archived_at", null)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (status) query = query.eq("status", status);
  if (clientId) query = query.eq("client_id", clientId);

  const { data, error } = await query;
  if (error) {
    if (isMissingTable(error)) throw new MigrationPendingError("jobs", error.message);
    throw new Error(`Could not load jobs: ${error.message}`);
  }

  return ((data ?? []) as (Job & {
    clients: Parameters<typeof clientDisplayName>[0] | null;
    visits: { id: string }[];
    whatsapp_messages: { id: string; media_mime: string | null }[] | null;
  })[]).map(({ clients, visits, whatsapp_messages, ...job }) => ({
    ...job,
    client_name: clients ? clientDisplayName(clients) : "Unknown client",
    visit_count: visits?.length ?? 0,
    message_count: whatsapp_messages?.length ?? 0,
    photo_count: whatsapp_messages?.filter((m) => m.media_mime?.startsWith("image/")).length ?? 0,
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
    if (isMissingTable(error)) throw new MigrationPendingError("jobs", error.message);
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

/** Just enough of a job row to decide whether a conversion may proceed. */
type JobStub = {
  id: string;
  job_number: number;
  status: JobStatus;
  archived_at: string | null;
};

const JOB_STUB_COLUMNS = "id, job_number, status, archived_at";

/**
 * The job a quote already became, archived or not.
 *
 * Deliberately NOT filtered on `archived_at`: a quote that was converted and
 * then had its job archived has still been converted, and quietly making a
 * second job would double the money in every report. Migration 0019 makes that
 * the database's rule too (`jobs_one_per_quote`); until it is applied this read
 * is the only thing standing between a double tap and two jobs.
 */
async function findJobForQuote(quoteId: string): Promise<JobStub | null> {
  const client = requireDb();
  const { data, error } = await client
    .from("jobs")
    .select(JOB_STUB_COLUMNS)
    .eq("quote_id", quoteId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isMissingTable(error)) throw new MigrationPendingError("jobs", error.message);
    throw new Error(`Could not check whether the quote was already converted: ${error.message}`);
  }
  return (data as JobStub | null) ?? null;
}

/**
 * Close the loop on the quote so the pipeline reflects reality.
 *
 * Guarded on the quote still being `approved`, which makes it safe to re-run:
 * the insert and this update are two separate round trips with no transaction
 * around them, so a run that created the job and then lost the connection
 * leaves an approved quote with a job hanging off it. The next press of the
 * button finds the job, returns it, and finishes this half.
 */
async function markQuoteConverted(quoteId: string): Promise<void> {
  const client = requireDb();
  const { error } = await client
    .from("quotes")
    .update({ status: "converted", converted_at: new Date().toISOString() })
    .eq("id", quoteId)
    .eq("status", "approved");
  if (error) {
    console.error(`[jobs] job created but quote ${quoteId} could not be closed: ${error.message}`);
  }
}

/**
 * Undo a job that never finished being built.
 *
 * There is no transaction available through PostgREST, so a failed line-item
 * insert would otherwise leave an empty job on the board: a row with a number,
 * a customer and no work on it, which reads as a real job and totals zero. It
 * is seconds old and nothing points at it, so removing it is safe and makes the
 * whole conversion all-or-nothing.
 */
async function rollbackJob(jobId: string, because: string): Promise<void> {
  const client = db();
  if (!client) return;
  const { error } = await client.from("jobs").delete().eq("id", jobId);
  if (error) {
    console.error(
      `[jobs] ${because}, and the half-built job ${jobId} could not be removed either: ${error.message}`,
    );
  }
}

/** The job's lines, in the shape `job_line_items` wants. */
function jobLineRows(jobId: string, lines: DocumentLine[]) {
  return lines.map((line, index) => ({
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
}

/**
 * Turn an approved quote into a job.
 *
 * Only the optional lines the customer actually ticked are copied — an option
 * they declined is not work, and carrying it across "just in case" puts it in
 * front of a crew as if it were agreed.
 *
 * Idempotent: a quote already converted returns its existing job with
 * `created: false` rather than making a second one, because the convert button
 * is exactly the sort of thing that gets double-tapped on a phone. An existing
 * job that has been ARCHIVED is refused instead of returned — handing back a
 * job the owner deliberately took off the board would look like the button did
 * nothing.
 *
 * The discount is carried as `discount_cents`, already resolved to an integer
 * number of cents by the money engine. Everything downstream re-applies it from
 * that frozen figure rather than re-resolving a percentage, so the job, and the
 * invoice after it, cannot drift from the quote the customer approved.
 */
export async function createJobFromQuote(quoteId: string): Promise<ConversionResult> {
  const client = requireDb();

  const existing = await findJobForQuote(quoteId);
  if (existing) {
    if (existing.archived_at) {
      refuse(
        "already_converted",
        `This quote already became job #${existing.job_number}, which is archived. ` +
          `Restore that job instead of converting the quote again.`,
      );
    }
    await markQuoteConverted(quoteId);
    return { id: existing.id, created: false };
  }

  const quote = await getQuote(quoteId);
  if (!quote) refuse("not_found", "That quote no longer exists.");
  if (quote.status !== "approved") {
    refuse(
      "wrong_status",
      `Only an approved quote can become a job — this one is ` +
        `${QUOTE_STATUS_LABEL[quote.status].toLowerCase()}.`,
    );
  }

  const rate = await resolveQuoteTaxRateForQuote(quote);
  const included = quote.lines.filter(
    (line) => line.kind === "text" || !line.optional || line.selected,
  ) as DocumentLine[];
  const totals = calculateQuoteTotals(priced(included).map(lineForTotals), rate, {
    kind: quote.discount_kind,
    value: quote.discount_value,
  });

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
    if (isMissingTable(error)) throw new MigrationPendingError("jobs", error.message);
    // `jobs_one_per_quote` fired: another tap got here first, in the window
    // between our read above and this insert. Go and read what it made.
    if (isDuplicateKey(error)) {
      const winner = await findJobForQuote(quoteId);
      if (winner && !winner.archived_at) {
        await markQuoteConverted(quoteId);
        return { id: winner.id, created: false };
      }
      refuse("already_converted", "This quote has already been converted to a job.");
    }
    throw new Error(`Could not create the job: ${error.message}`);
  }

  const jobId = data.id as string;
  const rows = jobLineRows(jobId, included);

  if (rows.length > 0) {
    const { error: linesError } = await client.from("job_line_items").insert(rows);
    if (linesError) {
      await rollbackJob(jobId, "the job's lines could not be copied");
      throw new Error(`Could not copy the lines: ${linesError.message}`);
    }
  }

  await markQuoteConverted(quoteId);

  // An estimate built under a project should hand its job straight to that
  // same project — attaching it by hand every time is exactly the kind of
  // step that gets forgotten. Best-effort: a project link failing here is
  // not a reason to fail the job that was just successfully created.
  if (quote.project_id) {
    try {
      await attachJob(quote.project_id, jobId);
    } catch (err) {
      console.warn(
        `[jobs] could not attach job ${jobId} to project ${quote.project_id}: ` +
          `${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return { id: jobId, created: true };
}

// ---------------------------------------------------------------------------
// A job with no quote behind it
// ---------------------------------------------------------------------------

/** One line of work, as a form or a phone call describes it. */
export type JobLineInput = {
  kind?: "item" | "text";
  name: string;
  description?: string | null;
  /** Thousandths. Defaults to exactly one of whatever it is. */
  quantityMilli?: number | null;
  unit?: string | null;
  unitCostCents?: number | null;
  unitPriceCents?: number | null;
  taxable?: boolean;
  laborHours?: number | null;
};

function inputLine(line: JobLineInput, position: number): DocumentLine {
  const isText = (line.kind ?? "item") === "text";
  return {
    id: `new-${position}`,
    position,
    kind: isText ? "text" : "item",
    name: line.name.trim().slice(0, 500) || (isText ? "—" : "Work"),
    description: line.description?.trim() || null,
    quantity_milli: isText ? null : (line.quantityMilli ?? 1000),
    unit: line.unit?.trim() || null,
    unit_cost_cents: isText ? null : (line.unitCostCents ?? null),
    unit_price_cents: isText ? null : (line.unitPriceCents ?? 0),
    taxable: line.taxable ?? true,
    optional: false,
    selected: false,
    labor_hours: line.laborHours ?? null,
    price_book_item_id: null,
  };
}

/**
 * Start a job straight from a client, with no quote in front of it.
 *
 * This is how most work actually arrives. Somebody telephones about a leak, the
 * crew goes out the same afternoon, and the paperwork catches up afterwards.
 * Forcing that through "write an estimate, send it, mark it approved, convert
 * it" would mean four fictions recorded as facts — a quote nobody wrote, a send
 * that never happened, an approval nobody gave.
 *
 * What freezes here is what freezes when a quote is sent: the customer's name
 * and address, the service address, and the tax rate. Resolved live at this
 * moment because this IS the moment the work is agreed — there is no earlier
 * document whose numbers have to be honoured.
 *
 * Idempotent against a double submit only: an identical untouched job for the
 * same client created in the last couple of minutes is handed back rather than
 * duplicated. Beyond that window a second job for the same client is a normal
 * thing to want and is created.
 */
export async function createJobForClient(
  clientId: string,
  input: {
    propertyId?: string | null;
    title?: string | null;
    instructions?: string | null;
    internalNotes?: string | null;
    lines?: JobLineInput[];
  } = {},
  now: Date = new Date(),
): Promise<ConversionResult> {
  const client = requireDb();
  const title = orNull(input.title);
  const propertyId = input.propertyId || null;

  const duplicate = await findRecentDirectJob(clientId, title, now);
  if (duplicate) return { id: duplicate.id, created: false };

  const snapshots = await loadDocumentSnapshots(clientId, propertyId);

  // Same precedence as a quote: the job's own rate (there isn't one yet), then
  // the property's, then the client's, then the account default — and the
  // registration gate above all of it.
  const company = await getCompany();
  let rate: TaxRate = { id: "unregistered", label: "No tax", components: [] };
  if (canChargeTax(company)) {
    rate = resolveTaxRate(
      await getTaxRates(),
      null,
      snapshots.propertyTaxRateId,
      snapshots.clientTaxRateId,
    );
  }

  const lines = (input.lines ?? []).slice(0, 100).map(inputLine);
  const totals = calculateQuoteTotals(priced(lines).map(lineForTotals), rate);

  const { data, error } = await client
    .from("jobs")
    .insert({
      client_id: clientId,
      property_id: propertyId,
      quote_id: null,
      title,
      instructions: orNull(input.instructions),
      internal_notes: orNull(input.internalNotes),
      status: "unscheduled",
      tax_snapshot: rate,
      client_snapshot: snapshots.client,
      property_snapshot: snapshots.property,
      subtotal_cents: totals.subtotalCents,
      discount_cents: totals.discountCents,
      tax_cents: totals.totalTaxCents,
      total_cents: totals.totalCents,
    })
    .select("id")
    .single();

  if (error) {
    if (isMissingTable(error)) throw new MigrationPendingError("jobs", error.message);
    throw new Error(`Could not create the job: ${error.message}`);
  }

  const jobId = data.id as string;

  if (lines.length > 0) {
    const { error: linesError } = await client
      .from("job_line_items")
      .insert(jobLineRows(jobId, lines));
    if (linesError) {
      await rollbackJob(jobId, "the job's lines could not be written");
      throw new Error(`Could not save the lines: ${linesError.message}`);
    }
  }

  return { id: jobId, created: true };
}

/** How long two identical direct jobs are treated as one double submit. */
const DOUBLE_SUBMIT_WINDOW_MS = 2 * 60_000;

async function findRecentDirectJob(
  clientId: string,
  title: string | null,
  now: Date,
): Promise<JobStub | null> {
  const client = requireDb();
  const since = new Date(now.getTime() - DOUBLE_SUBMIT_WINDOW_MS).toISOString();

  let query = client
    .from("jobs")
    .select(JOB_STUB_COLUMNS)
    .eq("client_id", clientId)
    .is("quote_id", null)
    .is("archived_at", null)
    .eq("status", "unscheduled")
    .gte("created_at", since)
    .limit(1);
  query = title === null ? query.is("title", null) : query.eq("title", title);

  const { data, error } = await query.maybeSingle();
  if (error) {
    if (isMissingTable(error)) throw new MigrationPendingError("jobs", error.message);
    // Not worth failing the conversion over: the worst case is a duplicate the
    // owner can archive, and refusing to create the job at all is worse.
    console.error(`[jobs] could not check for a double submit: ${error.message}`);
    return null;
  }
  return (data as JobStub | null) ?? null;
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

/**
 * Whether this job may go on the calendar at all.
 *
 * Two states refuse. A CANCELLED job is work that was called off — putting it
 * back on the schedule sends a crew to a house where nobody is expecting them,
 * and (before the dialer's withdrawal hooks in the jobs actions) telephones the
 * customer the night before to confirm it. An ARCHIVED job has been filed away;
 * a date on it would surface on the schedule while the job itself is hidden
 * from every list, which is the worst of both.
 *
 * Checked here rather than at each call site so that the one-click button, the
 * date form and the recurrence generator cannot disagree about it.
 */
async function loadSchedulableJob(jobId: string): Promise<JobStub> {
  const client = requireDb();
  const { data, error } = await client
    .from("jobs")
    .select(JOB_STUB_COLUMNS)
    .eq("id", jobId)
    .maybeSingle();

  if (error) {
    if (isMissingTable(error)) throw new MigrationPendingError("jobs", error.message);
    throw new Error(`Could not load the job: ${error.message}`);
  }

  const job = (data as JobStub | null) ?? null;
  if (!job) refuse("not_found", "That job no longer exists.");

  if (job.status === "cancelled") {
    refuse(
      "wrong_status",
      `Job #${job.job_number} was cancelled. Put it back to unscheduled before booking a visit.`,
    );
  }
  if (job.archived_at) {
    refuse(
      "wrong_status",
      `Job #${job.job_number} is archived. Restore it before booking a visit.`,
    );
  }
  return job;
}

export async function createVisit(
  jobId: string,
  input: { title?: string | null; startsAt: string; endsAt?: string | null; allDay?: boolean; notes?: string | null },
): Promise<string> {
  const client = requireDb();
  await loadSchedulableJob(jobId);

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
    if (isMissingTable(error)) throw new MigrationPendingError("visits", error.message);
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

/**
 * Put a job on the calendar in one press.
 *
 * The default is the next working day, 08:00–12:00 Toronto — see
 * `nextWorkingDayWindow`. It is a starting point, not a commitment: the visit
 * appears on the schedule where the owner can drag it, and the date form beside
 * the button still does everything it did.
 *
 * Idempotent when no date is given. A job that already has an unfinished visit
 * still in the future is already scheduled, so the second press hands that visit
 * back rather than stacking a duplicate on top of it. Passing an explicit
 * `startsAt` always books a new one: a second trip is a normal thing to want,
 * and the operator typing a date has said which.
 */
export async function scheduleJobVisit(
  jobId: string,
  input: {
    startsAt?: string;
    endsAt?: string | null;
    title?: string | null;
    notes?: string | null;
    allDay?: boolean;
  } = {},
  now: Date = new Date(),
): Promise<ConversionResult> {
  const client = requireDb();
  await loadSchedulableJob(jobId);

  if (!input.startsAt) {
    const { data, error } = await client
      .from("visits")
      .select("id")
      .eq("job_id", jobId)
      .is("completed_at", null)
      .gt("starts_at", now.toISOString())
      .order("starts_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error && !isMissingTable(error)) {
      throw new Error(`Could not check the job's schedule: ${error.message}`);
    }
    const booked = (data as { id: string } | null) ?? null;
    if (booked) return { id: booked.id, created: false };
  }

  const window = nextWorkingDayWindow(now);
  const visitId = await createVisit(jobId, {
    title: input.title ?? null,
    startsAt: input.startsAt ?? window.startsAt,
    endsAt: input.startsAt ? (input.endsAt ?? null) : (input.endsAt ?? window.endsAt),
    allDay: input.allDay ?? false,
    notes: input.notes ?? null,
  });

  return { id: visitId, created: true };
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

/**
 * Remove a visit.
 *
 * Nothing else has to be cleaned up after this. `call_tasks.visit_id` is
 * declared `on delete cascade` in migration 0018, so any queued call about this
 * visit goes with the row — there is deliberately no `onVisitCancelled` call
 * here, because there would be nothing left for it to cancel.
 */
export async function deleteVisit(id: string): Promise<void> {
  const client = requireDb();
  const { error } = await client.from("visits").delete().eq("id", id);
  if (error) throw new Error(`Could not remove the visit: ${error.message}`);
}

/**
 * Just the ids of a job's visits.
 *
 * For the callers that need to react to something happening to a whole job —
 * withdrawing the dialer's queued calls when the job is called off, for one.
 * `getJob` answers the same question but drags every line item along with it.
 *
 * Returns an empty list rather than throwing, including when the database is
 * unconfigured. Every caller is a best-effort side effect running after the
 * operator's real action has already succeeded, and none of them is worth
 * turning into a failed click.
 */
export async function listJobVisitIds(jobId: string): Promise<string[]> {
  const client = db();
  if (!client) return [];

  const { data, error } = await client.from("visits").select("id").eq("job_id", jobId);
  if (error) {
    console.error(`[jobs] could not list the visits for job ${jobId}: ${error.message}`);
    return [];
  }
  return ((data ?? []) as { id: string }[]).map((visit) => visit.id);
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
    if (isMissingTable(error)) throw new MigrationPendingError("visits", error.message);
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
  // A pattern writes ordinary visit rows, so it is subject to the same rule as
  // booking one by hand: a cancelled or archived job does not go on the
  // calendar, and certainly not twenty-six times.
  await loadSchedulableJob(jobId);

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
