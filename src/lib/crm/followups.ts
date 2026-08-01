import { db, isMissingTable } from "./db";
import { emailQuoteFollowup, emailInvoiceReminder, type SendResult } from "./sendDocument";

/**
 * Automated follow-ups: the polite persistence Jobber sells as a feature.
 *
 * Two sweeps, run daily by /api/cron/followups:
 *
 *   1. Quotes sitting in 'sent' — issued, never opened-and-answered — get one
 *      nudge after QUOTE_FOLLOWUP_AFTER_DAYS, provided the quote has not
 *      expired. One, not a drip: a renovation quote the customer ignored twice
 *      is a no, and a third email converts nothing but goodwill.
 *
 *   2. Unpaid invoices past their due date get a first reminder at
 *      INVOICE_REMINDER_1_AFTER_DAYS overdue and a second, firmer one at
 *      INVOICE_REMINDER_2_AFTER_DAYS. An invoice already deep overdue when
 *      this feature ships gets only the reminder its age calls for — never
 *      two emails on the same day.
 *
 * THE ORDERING RULE, which is the whole design: the followup_log row is
 * inserted BEFORE the email is handed to the transport. The unique indexes in
 * migration 0013 make each (kind, document) sendable exactly once, so a
 * duplicate insert fails loudly instead of a duplicate email arriving
 * quietly. The failure mode this buys is the acceptable one — a run that
 * crashes between insert and send skips that follow-up forever, costing one
 * nudge. The reverse ordering risks double-sending, and a customer who gets
 * the same payment reminder twice remembers it.
 *
 * The one refinement: when the sender itself declines BEFORE touching the
 * transport (no recipients on file, no public link), nothing was sent and
 * nothing can have been, so the log row is deleted to let a later run retry —
 * the owner may add the missing email address next week. A throw from the
 * transport, by contrast, leaves the row in place: outcome unknown, so never
 * retry.
 */

// Thresholds. Constants rather than settings for now — sensible defaults the
// owner has not asked to tune. If that changes, these belong in app_settings
// next to quote_defaults, with the same read-with-fallback pattern.
export const QUOTE_FOLLOWUP_AFTER_DAYS = 5;
export const INVOICE_REMINDER_1_AFTER_DAYS = 3;
export const INVOICE_REMINDER_2_AFTER_DAYS = 14;

// Per-run cap, per category. The first run after deployment may find months
// of backlog, and a company that has never sent a reminder suddenly sending
// forty in one morning reads as spam to customers and to mail filters alike.
// The backlog drains at this rate daily.
const MAX_SENDS_PER_RUN = 25;

export type FollowupSummary = {
  /** Documents that matched the rules and had no log row yet. */
  candidates: number;
  /** Emails actually handed to the transport without error. */
  sent: number;
  /** Human-readable per-document skips and errors, for the cron's JSON. */
  notes: string[];
};

/**
 * Today as a calendar date in America/Toronto, formatted YYYY-MM-DD.
 *
 * due_date and valid_until are plain dates; comparing them against a UTC
 * "today" would make invoices go overdue at 8 p.m. the previous evening,
 * Laval time. en-CA is the one locale whose default date format IS ISO.
 */
function torontoToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto" }).format(new Date());
}

/** Whole days from one YYYY-MM-DD to another (positive when `to` is later). */
function daysBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000);
}

/** A date `days` before the given YYYY-MM-DD, same format. */
function daysBefore(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - days)).toISOString().slice(0, 10);
}

type LogTarget = { quote_id: string } | { invoice_id: string };

/**
 * Claim the right to send: insert the log row, or explain why not.
 *
 * Returns "claimed" when this run owns the send, "duplicate" when another run
 * (or an earlier crash-after-insert) already does, and the error text
 * otherwise. "duplicate" is not an anomaly — it is the schema doing its job.
 */
async function claim(kind: string, target: LogTarget): Promise<"claimed" | "duplicate" | string> {
  const client = db();
  if (!client) return "database is not configured";

  const { error } = await client.from("followup_log").insert({ kind, ...target });
  if (!error) return "claimed";
  if (error.code === "23505") return "duplicate";
  return error.message;
}

/** Undo a claim that provably sent nothing (the sender skipped pre-transport). */
async function releaseClaim(kind: string, target: LogTarget): Promise<void> {
  const client = db();
  if (!client) return;
  let query = client.from("followup_log").delete().eq("kind", kind);
  query = "quote_id" in target ? query.eq("quote_id", target.quote_id) : query.eq("invoice_id", target.invoice_id);
  await query;
}

/**
 * Shared claim → send → reconcile step. `send` must uphold the SendResult
 * contract: a `skipped` reason means the transport was never touched.
 */
async function claimAndSend(
  kind: string,
  target: LogTarget,
  label: string,
  send: () => Promise<SendResult>,
  summary: FollowupSummary,
): Promise<void> {
  const claimed = await claim(kind, target);
  if (claimed === "duplicate") return; // already handled, nothing to report
  if (claimed !== "claimed") {
    summary.notes.push(`${label}: could not record the send (${claimed})`);
    return;
  }

  let result: SendResult;
  try {
    result = await send();
  } catch (err) {
    // Transport attempted, outcome unknown. The log row STAYS: skipping this
    // follow-up is the cost of never double-sending.
    const message = err instanceof Error ? err.message : String(err);
    summary.notes.push(`${label}: send failed after logging — will not retry (${message})`);
    return;
  }

  if (result.skipped) {
    // Deterministic pre-transport skip (no recipients, no link). Nothing went
    // out, so release the claim and let a later run try again once fixed.
    await releaseClaim(kind, target);
    summary.notes.push(`${label}: skipped (${result.skipped})`);
    return;
  }

  summary.sent += 1;
  console.log(`[followups] ${kind} sent for ${label} to ${result.sent.length} recipient(s)`);
}

// ---------------------------------------------------------------------------
// Quotes
// ---------------------------------------------------------------------------

type QuoteRow = {
  id: string;
  client_id: string;
  quote_number: number;
  title: string | null;
  total_cents: number;
  language: "fr" | "en";
  public_token: string | null;
  valid_until: string | null;
};

/** One nudge per quote still in 'sent' after the waiting period, unexpired. */
export async function runQuoteFollowups(): Promise<FollowupSummary> {
  const summary: FollowupSummary = { candidates: 0, sent: 0, notes: [] };

  const client = db();
  if (!client) {
    summary.notes.push("skipped: database is not configured");
    return summary;
  }
  if (!process.env.RESEND_API_KEY) {
    // Checked before any log writes: an unconfigured transport must be a
    // clean no-op, not a table full of claims for emails that never existed.
    summary.notes.push("skipped: email transport is not configured (RESEND_API_KEY is missing)");
    console.warn("[followups] RESEND_API_KEY is not set — quote follow-ups skipped");
    return summary;
  }

  const today = torontoToday();
  const sentBefore = new Date(Date.now() - QUOTE_FOLLOWUP_AFTER_DAYS * 86_400_000).toISOString();

  // Status 'sent' only, deliberately: 'viewed' means the customer opened the
  // link and is deciding, and nudging someone mid-decision reads as pressure.
  const { data, error } = await client
    .from("quotes")
    .select("id, client_id, quote_number, title, total_cents, language, public_token, valid_until")
    .eq("status", "sent")
    .lte("sent_at", sentBefore)
    .is("archived_at", null)
    .or(`valid_until.is.null,valid_until.gte.${today}`)
    .order("sent_at", { ascending: true })
    .limit(200);

  if (error) {
    summary.notes.push(`skipped: could not list quotes (${error.message})`);
    return summary;
  }

  const quotes = (data ?? []) as QuoteRow[];
  if (quotes.length === 0) return summary;

  // Which of these already got their nudge. A missing table here means
  // migration 0013 has not run — report that instead of a raw Postgres error,
  // same convention as isMissingTable everywhere else.
  const { data: logged, error: logError } = await client
    .from("followup_log")
    .select("quote_id")
    .eq("kind", "quote_followup")
    .in("quote_id", quotes.map((q) => q.id));

  if (logError) {
    summary.notes.push(
      isMissingTable(logError)
        ? "skipped: migration 0013 not run"
        : `skipped: could not read followup_log (${logError.message})`,
    );
    return summary;
  }

  const done = new Set((logged ?? []).map((row) => (row as { quote_id: string }).quote_id));
  const pending = quotes.filter((q) => !done.has(q.id));
  summary.candidates = pending.length;

  for (const quote of pending.slice(0, MAX_SENDS_PER_RUN)) {
    await claimAndSend(
      "quote_followup",
      { quote_id: quote.id },
      `quote #${quote.quote_number}`,
      () => emailQuoteFollowup(quote),
      summary,
    );
  }
  if (pending.length > MAX_SENDS_PER_RUN) {
    summary.notes.push(`${pending.length - MAX_SENDS_PER_RUN} deferred to tomorrow (per-run cap)`);
  }

  return summary;
}

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------

type InvoiceRow = {
  id: string;
  client_id: string;
  invoice_number: number;
  total_cents: number;
  amount_paid_cents: number;
  due_date: string | null;
  language: "fr" | "en";
  public_token: string | null;
};

/**
 * Payment reminders on overdue invoices: reminder 1 at ≥3 days past due,
 * reminder 2 at ≥14, each at most once — and at most one email per invoice
 * per run, because an invoice found already ≥14 days overdue gets only the
 * second-stage reminder, not both back to back.
 */
export async function runInvoiceReminders(): Promise<FollowupSummary> {
  const summary: FollowupSummary = { candidates: 0, sent: 0, notes: [] };

  const client = db();
  if (!client) {
    summary.notes.push("skipped: database is not configured");
    return summary;
  }
  if (!process.env.RESEND_API_KEY) {
    summary.notes.push("skipped: email transport is not configured (RESEND_API_KEY is missing)");
    console.warn("[followups] RESEND_API_KEY is not set — invoice reminders skipped");
    return summary;
  }

  const today = torontoToday();

  // 'sent', 'viewed' and 'part_paid' are the unpaid-but-issued states. Drafts
  // were never asked for, 'paid' is settled, and 'bad_debt' is a decision a
  // human already made — a robot must not reopen it.
  const { data, error } = await client
    .from("invoices")
    .select(
      "id, client_id, invoice_number, total_cents, amount_paid_cents, due_date, language, public_token",
    )
    .in("status", ["sent", "viewed", "part_paid"])
    .lte("due_date", daysBefore(today, INVOICE_REMINDER_1_AFTER_DAYS))
    .is("archived_at", null)
    .order("due_date", { ascending: true })
    .limit(200);

  if (error) {
    summary.notes.push(`skipped: could not list invoices (${error.message})`);
    return summary;
  }

  const invoices = ((data ?? []) as InvoiceRow[]).filter(
    // The payments trigger keeps status honest, but a zero or negative
    // balance must never be chased regardless of what status says.
    (invoice) => invoice.total_cents - invoice.amount_paid_cents > 0 && invoice.due_date,
  );
  if (invoices.length === 0) return summary;

  const { data: logged, error: logError } = await client
    .from("followup_log")
    .select("kind, invoice_id")
    .in("kind", ["invoice_reminder_1", "invoice_reminder_2"])
    .in("invoice_id", invoices.map((invoice) => invoice.id));

  if (logError) {
    summary.notes.push(
      isMissingTable(logError)
        ? "skipped: migration 0013 not run"
        : `skipped: could not read followup_log (${logError.message})`,
    );
    return summary;
  }

  const done = new Set(
    (logged ?? []).map((row) => {
      const entry = row as { kind: string; invoice_id: string };
      return `${entry.kind}:${entry.invoice_id}`;
    }),
  );

  // Resolve each invoice to the single reminder its age calls for.
  const pending: Array<{ invoice: InvoiceRow; kind: string; stage: 1 | 2 }> = [];
  for (const invoice of invoices) {
    const overdue = daysBetween(invoice.due_date!, today);
    const stage: 1 | 2 = overdue >= INVOICE_REMINDER_2_AFTER_DAYS ? 2 : 1;
    const kind = stage === 2 ? "invoice_reminder_2" : "invoice_reminder_1";
    if (!done.has(`${kind}:${invoice.id}`)) pending.push({ invoice, kind, stage });
  }
  summary.candidates = pending.length;

  for (const { invoice, kind, stage } of pending.slice(0, MAX_SENDS_PER_RUN)) {
    await claimAndSend(
      kind,
      { invoice_id: invoice.id },
      `invoice #${invoice.invoice_number}`,
      () => emailInvoiceReminder(invoice, stage),
      summary,
    );
  }
  if (pending.length > MAX_SENDS_PER_RUN) {
    summary.notes.push(`${pending.length - MAX_SENDS_PER_RUN} deferred to tomorrow (per-run cap)`);
  }

  return summary;
}
