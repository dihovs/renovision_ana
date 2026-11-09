import { randomBytes } from "crypto";
import { SITE_URL } from "@/lib/constants";
import { db, isMissingTable, MigrationPendingError } from "./db";

/**
 * Get Shareable Link — a view-only web copy of a project's report.
 *
 * What a link shows is decided by `/s/[token]`, not here: plans,
 * measurements, damage and photos, never prices, the client or the claim's
 * policy numbers. The token is the credential, so it is long, random and
 * never derived from anything; a link lapses after `SHARE_LINK_DAYS` and can
 * be revoked at any time. See migration 0059.
 */

export const SHARE_LINK_DAYS = 30;

export type ShareLink = {
  id: string;
  url: string;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  /** Neither revoked nor expired. */
  active: boolean;
};

type Row = {
  id: string;
  token: string;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
};

function requireDb() {
  const client = db();
  if (!client) throw new Error("Database is not configured");
  return client;
}

export function shareUrl(token: string): string {
  return `${SITE_URL}/s/${token}`;
}

function toLink(row: Row, now = Date.now()): ShareLink {
  return {
    id: row.id,
    url: shareUrl(row.token),
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    active: !row.revoked_at && new Date(row.expires_at).getTime() > now,
  };
}

/** A fresh link for a project. Every call mints a new one — an old link
    handed to the wrong person is revoked, not reused. */
export async function createShareLink(projectId: string): Promise<ShareLink> {
  const client = requireDb();
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SHARE_LINK_DAYS * 24 * 3600 * 1000);
  const { data, error } = await client
    .from("project_share_links")
    .insert({ project_id: projectId, token, expires_at: expires.toISOString() })
    .select("id, token, created_at, expires_at, revoked_at")
    .single();
  if (error) {
    if (isMissingTable(error)) throw new MigrationPendingError("project_share_links", error.message);
    throw new Error(`Could not create the link: ${error.message}`);
  }
  return toLink(data as Row);
}

/** Every link ever made for a project, newest first. */
export async function listShareLinks(projectId: string): Promise<ShareLink[]> {
  const client = requireDb();
  const { data, error } = await client
    .from("project_share_links")
    .select("id, token, created_at, expires_at, revoked_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) {
    if (isMissingTable(error)) return [];
    throw new Error(`Could not load the links: ${error.message}`);
  }
  return (data as Row[]).map((row) => toLink(row));
}

/** Stop a link working. Idempotent. */
export async function revokeShareLink(id: string): Promise<void> {
  const client = requireDb();
  const { error } = await client
    .from("project_share_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .is("revoked_at", null);
  if (error) {
    if (isMissingTable(error)) throw new MigrationPendingError("project_share_links", error.message);
    throw new Error(`Could not revoke the link: ${error.message}`);
  }
}

/** The project a live token opens, or null — unknown, revoked and expired
    all look the same from outside, on purpose. */
export async function projectForShareToken(token: string): Promise<string | null> {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
  const client = db();
  if (!client) return null;
  const { data, error } = await client
    .from("project_share_links")
    .select("project_id, expires_at, revoked_at")
    .eq("token", token)
    .maybeSingle();
  if (error || !data) return null;
  if (data.revoked_at) return null;
  if (new Date(data.expires_at as string).getTime() <= Date.now()) return null;
  return data.project_id as string;
}
