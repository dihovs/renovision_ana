import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { db, isMissingTable } from "@/lib/crm/db";

/**
 * Where the Microsoft connection lives, and why it is encrypted. (ANA-04)
 *
 * A refresh token is not a password — it is better than one. It survives a
 * password change, it does not expire on a schedule anyone watches, and it
 * opens the owner's mail and files to whoever holds it until somebody thinks to
 * revoke it. RLS and the service_role grant in 0047 keep the row off the API,
 * and neither of them helps if the row is read some other way: a database
 * backup, a support session, a restore into a staging project, a policy someone
 * loosens in two years. So the token is encrypted before it is stored, and the
 * key lives in the environment rather than the database.
 *
 * NO KEY MEANS NO CONNECTION. If MICROSOFT_TOKEN_KEY is unset, `connect`
 * refuses rather than storing a credential in plaintext "for now" — the same
 * shape as WhatsApp dispatch refusing rather than half-sending. A feature that
 * quietly downgrades its own security when misconfigured is worse than one that
 * does not start.
 */

/** Ciphertext format: v1.<iv>.<authTag>.<payload>, all base64url. */
const VERSION = "v1";

export type MicrosoftConnection = {
  accountUpn: string | null;
  accountName: string | null;
  tenantId: string | null;
  grantedScopes: string[];
  accessToken: string | null;
  accessExpiresAt: string | null;
  refreshToken: string | null;
  invalidatedAt: string | null;
  invalidatedReason: string | null;
};

export type TokenFailure = {
  ok: false;
  reason: "unconfigured" | "no_key" | "migration_pending" | "not_connected" | "failed";
  detail?: string;
};

/**
 * The 32 bytes AES-256 needs, or null.
 *
 * Hex rather than base64 because it is what `openssl rand -hex 32` prints, and
 * the setup instruction should be one command whose output is pasted unchanged.
 */
function encryptionKey(): Buffer | null {
  const raw = process.env.MICROSOFT_TOKEN_KEY?.trim();
  if (!raw) return null;
  if (!/^[0-9a-fA-F]{64}$/.test(raw)) {
    console.error("[microsoft] MICROSOFT_TOKEN_KEY must be 64 hex characters (32 bytes)");
    return null;
  }
  return Buffer.from(raw, "hex");
}

export function hasEncryptionKey(): boolean {
  return encryptionKey() !== null;
}

/**
 * Encrypt a token for storage.
 *
 * GCM rather than CBC so the ciphertext carries its own integrity check: a row
 * edited by hand, or truncated by a bad restore, fails to decrypt instead of
 * yielding a mangled token that produces a confusing 401 from Microsoft.
 */
export function encryptToken(plain: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const payload = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [
    VERSION,
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    payload.toString("base64url"),
  ].join(".");
}

/** Decrypt, or null if the value is malformed, truncated or from another key. */
export function decryptToken(stored: string | null, key: Buffer): string | null {
  if (!stored) return null;
  const parts = stored.split(".");
  if (parts.length !== 4 || parts[0] !== VERSION) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(parts[1], "base64url"));
    decipher.setAuthTag(Buffer.from(parts[2], "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(parts[3], "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    // Wrong key, tampered row, or a value written by a future format. All three
    // mean "we do not hold a usable token", which is a state the caller must
    // handle anyway.
    return null;
  }
}

function failureFor(error: { message: string }, what: string): TokenFailure {
  if (isMissingTable(error)) {
    console.warn(`[microsoft] ${what} — run supabase/migrations/0047_microsoft_tokens.sql`);
    return { ok: false, reason: "migration_pending" };
  }
  console.error(`[microsoft] ${what}:`, error.message);
  return { ok: false, reason: "failed", detail: error.message };
}

/** The stored connection, decrypted, or a reason there isn't one. */
export async function readConnection(): Promise<
  { ok: true; connection: MicrosoftConnection } | TokenFailure
> {
  const supabase = db();
  if (!supabase) return { ok: false, reason: "unconfigured" };
  const key = encryptionKey();
  if (!key) return { ok: false, reason: "no_key" };

  const { data, error } = await supabase
    .from("microsoft_tokens")
    .select(
      "account_upn, account_name, tenant_id, granted_scopes, access_token_enc, access_expires_at, refresh_token_enc, invalidated_at, invalidated_reason",
    )
    .maybeSingle();

  if (error) return failureFor(error, "could not read the connection");
  if (!data) return { ok: false, reason: "not_connected" };

  const row = data as Record<string, unknown>;
  return {
    ok: true,
    connection: {
      accountUpn: (row.account_upn as string) ?? null,
      accountName: (row.account_name as string) ?? null,
      tenantId: (row.tenant_id as string) ?? null,
      grantedScopes: (row.granted_scopes as string[]) ?? [],
      accessToken: decryptToken((row.access_token_enc as string) ?? null, key),
      accessExpiresAt: (row.access_expires_at as string) ?? null,
      refreshToken: decryptToken((row.refresh_token_enc as string) ?? null, key),
      invalidatedAt: (row.invalidated_at as string) ?? null,
      invalidatedReason: (row.invalidated_reason as string) ?? null,
    },
  };
}

/**
 * Write the connection, replacing whatever was there.
 *
 * 0047 allows exactly one row, so this deletes and inserts rather than trying
 * to upsert on a generated column. Re-consenting is meant to replace, not
 * accumulate: two rows would be two answers to "whose mail are we reading".
 */
export async function saveConnection(input: {
  accountUpn: string | null;
  accountName: string | null;
  tenantId: string | null;
  grantedScopes: string[];
  accessToken: string;
  expiresInSeconds: number;
  refreshToken: string | null;
}): Promise<{ ok: true } | TokenFailure> {
  const supabase = db();
  if (!supabase) return { ok: false, reason: "unconfigured" };
  const key = encryptionKey();
  if (!key) return { ok: false, reason: "no_key" };

  // A minute of slack, so a token is never handed out with two seconds left on
  // it and refused by Graph mid-request.
  const expiresAt = new Date(Date.now() + Math.max(0, input.expiresInSeconds - 60) * 1000);

  const existing = await supabase.from("microsoft_tokens").select("id").maybeSingle();
  const keepRefresh = input.refreshToken
    ? encryptToken(input.refreshToken, key)
    : ((existing.data as { refresh_token_enc?: string } | null)?.refresh_token_enc ?? null);

  const row = {
    account_upn: input.accountUpn,
    account_name: input.accountName,
    tenant_id: input.tenantId,
    granted_scopes: input.grantedScopes,
    access_token_enc: encryptToken(input.accessToken, key),
    access_expires_at: expiresAt.toISOString(),
    // A refresh response does not always carry a new refresh token. Overwriting
    // with null there would disconnect the account on the first silent renewal.
    refresh_token_enc: keepRefresh,
    invalidated_at: null,
    invalidated_reason: null,
  };

  const { error } = existing.data
    ? await supabase
        .from("microsoft_tokens")
        .update(row)
        .eq("id", (existing.data as { id: string }).id)
    : await supabase.from("microsoft_tokens").insert(row);

  if (error) return failureFor(error, "could not save the connection");
  return { ok: true };
}

/**
 * Mark the connection dead without deleting it.
 *
 * Kept so the admin can say "Microsoft stopped working on the 4th, because
 * consent was revoked" rather than showing an empty panel that reads as "never
 * set up". The difference matters when Ana starts answering "nothing was said
 * about the boiler" for a reason that has nothing to do with the boiler.
 */
export async function invalidateConnection(reason: string): Promise<void> {
  const supabase = db();
  if (!supabase) return;
  const { error } = await supabase
    .from("microsoft_tokens")
    .update({
      invalidated_at: new Date().toISOString(),
      invalidated_reason: reason.slice(0, 500),
      access_token_enc: null,
      access_expires_at: null,
    })
    .not("id", "is", null);
  if (error) console.error("[microsoft] could not invalidate the connection:", error.message);
}
