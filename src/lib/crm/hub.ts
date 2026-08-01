import { randomBytes } from "crypto";
import { db, isMissingTable } from "./db";
import type { Invoice } from "./opsTypes";
import type { Quote } from "./quoteTypes";
import type { Job } from "./opsTypes";
import { clientDisplayName } from "./types";

/**
 * The client hub — everything one customer can see about their own work.
 *
 * The token is the credential, so every query in this module filters by
 * client_id derived FROM that token. Nothing here ever takes a client id from
 * the request: that is the difference between "show me my invoices" and "show
 * me invoice 47".
 */

export type HubData = {
  clientName: string;
  quotes: Pick<
    Quote,
    | "id"
    | "quote_number"
    | "title"
    | "status"
    | "total_cents"
    | "created_at"
    | "valid_until"
    | "public_token"
    | "language"
  >[];
  jobs: Pick<Job, "id" | "job_number" | "title" | "status" | "total_cents" | "starts_on">[];
  invoices: Pick<
    Invoice,
    | "id"
    | "invoice_number"
    | "title"
    | "status"
    | "total_cents"
    | "amount_paid_cents"
    | "issue_date"
    | "due_date"
    | "public_token"
    | "language"
  >[];
};

/** Mint or return the client's hub link. */
export async function ensureHubToken(clientId: string): Promise<string> {
  const client = db();
  if (!client) throw new Error("Database is not configured");

  const { data, error } = await client
    .from("clients")
    .select("hub_token")
    .eq("id", clientId)
    .maybeSingle();

  if (error) {
    if (isMissingTable(error)) throw new Error("Run migration 0008_client_hub.sql first.");
    throw new Error(`Could not read the client: ${error.message}`);
  }

  const existing = (data as { hub_token: string | null } | null)?.hub_token;
  if (existing) return existing;

  const token = randomBytes(32).toString("hex");
  const { error: writeError } = await client
    .from("clients")
    .update({ hub_token: token })
    .eq("id", clientId);
  if (writeError) throw new Error(`Could not create the link: ${writeError.message}`);
  return token;
}

/** Revoke the link. The next one minted is a different token. */
export async function revokeHubToken(clientId: string): Promise<void> {
  const client = db();
  if (!client) throw new Error("Database is not configured");
  const { error } = await client
    .from("clients")
    .update({ hub_token: null })
    .eq("id", clientId);
  if (error) throw new Error(`Could not revoke the link: ${error.message}`);
}

export async function getHubData(token: string): Promise<HubData | null> {
  const client = db();
  if (!client) return null;
  if (!/^[a-f0-9]{40,80}$/i.test(token)) return null;

  const { data: clientRow, error } = await client
    .from("clients")
    .select("id, first_name, last_name, company_name")
    .eq("hub_token", token)
    .maybeSingle();

  if (error || !clientRow) return null;
  const clientId = (clientRow as { id: string }).id;

  void client
    .from("clients")
    .update({ hub_last_viewed_at: new Date().toISOString() })
    .eq("id", clientId)
    .then(() => undefined);

  // Drafts are excluded everywhere. A draft is a working document — showing a
  // customer a price that is still being decided invites a conversation about
  // a number nobody meant to offer yet.
  const [quotes, jobs, invoices] = await Promise.all([
    client
      .from("quotes")
      .select(
        "id, quote_number, title, status, total_cents, created_at, valid_until, public_token, language",
      )
      .eq("client_id", clientId)
      .is("archived_at", null)
      .neq("status", "draft")
      .order("created_at", { ascending: false }),
    client
      .from("jobs")
      .select("id, job_number, title, status, total_cents, starts_on")
      .eq("client_id", clientId)
      .is("archived_at", null)
      .order("created_at", { ascending: false }),
    client
      .from("invoices")
      .select(
        "id, invoice_number, title, status, total_cents, amount_paid_cents, issue_date, due_date, public_token, language",
      )
      .eq("client_id", clientId)
      .is("archived_at", null)
      .neq("status", "draft")
      .order("issue_date", { ascending: false }),
  ]);

  return {
    clientName: clientDisplayName(clientRow as Parameters<typeof clientDisplayName>[0]),
    quotes: (quotes.data ?? []) as HubData["quotes"],
    jobs: (jobs.data ?? []) as HubData["jobs"],
    invoices: (invoices.data ?? []) as HubData["invoices"],
  };
}
