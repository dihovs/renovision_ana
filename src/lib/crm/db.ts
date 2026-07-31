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
export function isMissingTable(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: string }).code;
  if (code === "42P01" || code === "PGRST205") return true;
  const message = (error as { message?: string }).message ?? "";
  return /relation .* does not exist|could not find the table/i.test(message);
}

/** Thrown when the CRM tables are absent, so pages can render a notice. */
export class MigrationPendingError extends Error {
  constructor(table: string) {
    super(`The "${table}" table does not exist yet — run the migration in supabase/migrations.`);
    this.name = "MigrationPendingError";
  }
}
