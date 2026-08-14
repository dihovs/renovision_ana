import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Shared server-side Supabase client for the CRM tables.
 *
 * Same service-role key and same rules as `leadStore`: server-only, never
 * prefixed NEXT_PUBLIC_, bypasses row-level security. Split into its own module
 * so the CRM doesn't import the lead pipeline just to reach the database.
 */

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const isConfigured = Boolean(url && serviceKey);

let client: SupabaseClient | null = null;

export function db(): SupabaseClient | null {
  if (!isConfigured) return null;
  client ??= createClient(url!, serviceKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

/**
 * True when the failure is "this table hasn't been created yet".
 *
 * Shipping a query before its migration ran once took the whole admin page
 * down with a raw Postgres error. Detecting that specific case lets the UI say
 * "run the migration" instead, so deploy order stops being load-bearing.
 *
 * 42P01 is undefined_table; PGRST205 is PostgREST failing to find it in the
 * schema cache, which is what actually surfaces through supabase-js.
 */
/**
 * An EMBED failed — PostgREST could not resolve a relationship between two
 * tables — as opposed to a table being absent outright.
 *
 * Worth separating because the consequences differ. A missing table means a
 * feature cannot work. A failed embed usually means the schema cache has not
 * caught up with a migration that HAS run, and the parent rows are perfectly
 * readable without the join. Treating the second as the first took down the
 * whole project list and told the operator to run a migration they had
 * already run.
 */
export function isEmbedFailure(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  if ((error as { code?: string }).code === "PGRST200") return true;
  const message = (error as { message?: string }).message ?? "";
  return /could not find a relationship/i.test(message);
}

export function isMissingTable(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: string }).code;
  // PGRST200 is PostgREST failing an EMBED because the related table's
  // migration hasn't run (or its schema cache is stale) — same operator
  // remedy as a missing table, and without it a query like
  // projects.select("*, room_scans(...)") turns into a generic 500 that
  // hides the "run the migration" notice.
  if (code === "42P01" || code === "PGRST205" || code === "PGRST200") return true;
  const message = (error as { message?: string }).message ?? "";
  return /relation .* does not exist|could not find the table|could not find a relationship/i.test(message);
}

/** Thrown when the CRM tables are absent, so pages can render a notice. */
export class MigrationPendingError extends Error {
  /**
   * `detail` is the database's own words, and carrying them is the whole
   * point. PostgREST reports a failed EMBED and a genuinely absent table in
   * ways this codebase cannot always tell apart, so "the room_scans table
   * does not exist" has been shown for a table that plainly did exist — the
   * real cause being a relationship its schema cache had not caught up with.
   * Naming the underlying error turns a wrong instruction into a diagnosis.
   */
  constructor(table: string, detail?: string) {
    super(
      `The "${table}" table is not reachable — run the migration in supabase/migrations, ` +
        `or reload Supabase's schema cache.` +
        (detail ? ` Database said: ${detail}` : ""),
    );
    this.name = "MigrationPendingError";
  }
}
