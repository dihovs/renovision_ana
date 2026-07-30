import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Lead persistence.
 *
 * Uses the service-role key, which bypasses row-level security — the `leads`
 * table has RLS enabled with no policies, so nothing else can touch it. That
 * key must never reach the browser: this module is server-only and the env var
 * is deliberately not prefixed with NEXT_PUBLIC_.
 *
 * Every function degrades to a no-op when the environment isn't configured, so
 * the site keeps working (email-only, as before) until the Supabase project
 * exists. `isConfigured` lets callers tell "not set up" apart from "failed",
 * which matters because only the latter should fail a customer's submission.
 */

export type StoredLead = {
  id: string;
  created_at: string;
  name: string;
  email: string;
  phone: string;
  address: string | null;
  locale: string;
  marketing_consent: boolean;
  scope_summary: string | null;
  estimate_low: string | null;
  estimate_expected: string | null;
  estimate_high: string | null;
  total: string | null;
  estimated_work_days: number | null;
  status: LeadStatus;
  notes: string | null;
  photo_paths: string[];
};

/** Bucket is private; photos are only ever reachable via a signed URL. */
const PHOTO_BUCKET = "lead-photos";
/** Long enough to read a lead on site, short enough that a copied link dies. */
const SIGNED_URL_TTL_SECONDS = 60 * 60;

export const LEAD_STATUSES = ["new", "contacted", "quoted", "won", "lost"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export type NewLead = {
  name: string;
  email: string;
  phone: string;
  address?: string;
  locale?: string;
  marketingConsent?: boolean;
  consent?: { grantedAt: string; wording: string; locale: string; source: string };
  scopeSummary?: string;
  estimateLow?: string;
  estimateExpected?: string;
  estimateHigh?: string;
  lines?: unknown;
  exclusions?: unknown;
  subtotal?: string;
  gst?: string;
  qst?: string;
  total?: string;
  totalLaborHours?: number;
  estimatedWorkDays?: number;
  /** Storage object paths, not URLs — see uploadLeadPhotos. */
  photoPaths?: string[];
};

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const isConfigured = Boolean(url && serviceKey);

let client: SupabaseClient | null = null;
function getClient(): SupabaseClient | null {
  if (!isConfigured) return null;
  // Created lazily and reused. No session persistence or token refresh: this is
  // a server-side service-role client, not a logged-in user.
  client ??= createClient(url!, serviceKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

/**
 * Store a lead. Returns the new row id, or null if storage isn't configured.
 * Throws when configured but the insert fails — the caller decides what a
 * storage failure means for the customer's request.
 */
export async function saveLead(lead: NewLead): Promise<string | null> {
  const db = getClient();
  if (!db) return null;

  const { data, error } = await db
    .from("leads")
    .insert({
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      address: lead.address ?? null,
      locale: lead.locale ?? "fr",
      marketing_consent: lead.marketingConsent ?? false,
      // Consent evidence is stored alongside the answer, never instead of it.
      consent_granted_at: lead.consent?.grantedAt ?? null,
      consent_wording: lead.consent?.wording ?? null,
      consent_locale: lead.consent?.locale ?? null,
      consent_source: lead.consent?.source ?? null,
      scope_summary: lead.scopeSummary ?? null,
      estimate_low: lead.estimateLow ?? null,
      estimate_expected: lead.estimateExpected ?? null,
      estimate_high: lead.estimateHigh ?? null,
      estimate_lines: lead.lines ?? null,
      estimate_exclusions: lead.exclusions ?? null,
      subtotal: lead.subtotal ?? null,
      gst: lead.gst ?? null,
      qst: lead.qst ?? null,
      total: lead.total ?? null,
      total_labor_hours: lead.totalLaborHours ?? null,
      estimated_work_days: lead.estimatedWorkDays ?? null,
      photo_paths: lead.photoPaths ?? [],
    })
    .select("id")
    .single();

  if (error) throw new Error(`Supabase insert failed: ${error.message}`);
  return data.id as string;
}

/** Newest first — the only order the pipeline view ever needs. */
export async function listLeads(limit = 200): Promise<StoredLead[]> {
  const db = getClient();
  if (!db) return [];
  const { data, error } = await db
    .from("leads")
    .select(
      "id, created_at, name, email, phone, address, locale, marketing_consent, scope_summary, estimate_low, estimate_expected, estimate_high, total, estimated_work_days, status, notes",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Supabase select failed: ${error.message}`);
  return (data ?? []) as StoredLead[];
}

export async function updateLeadStatus(id: string, status: LeadStatus): Promise<void> {
  const db = getClient();
  if (!db) throw new Error("Lead storage is not configured");
  const { error } = await db.from("leads").update({ status }).eq("id", id);
  if (error) throw new Error(`Supabase update failed: ${error.message}`);
}

export async function updateLeadNotes(id: string, notes: string): Promise<void> {
  const db = getClient();
  if (!db) throw new Error("Lead storage is not configured");
  const { error } = await db.from("leads").update({ notes }).eq("id", id);
  if (error) throw new Error(`Supabase update failed: ${error.message}`);
}

/**
 * Upload customer photos to the private bucket, returning storage paths.
 *
 * Failures are swallowed per-photo on purpose: a photo that won't upload must
 * not cost the customer their enquiry. The lead is the thing that matters; the
 * picture is supporting evidence, and it still reaches the owner by email.
 */
export async function uploadLeadPhotos(dataUrls: string[]): Promise<string[]> {
  const db = getClient();
  if (!db || dataUrls.length === 0) return [];

  const paths: string[] = [];
  for (const [i, dataUrl] of dataUrls.entries()) {
    const match = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(dataUrl);
    if (!match) continue;
    const [, mime, base64] = match;
    const ext = mime.split("/")[1].replace("jpeg", "jpg");
    // Date-prefixed so the bucket stays browsable as it grows.
    const stamp = new Date().toISOString().slice(0, 10);
    const path = `${stamp}/${crypto.randomUUID()}-${i + 1}.${ext}`;
    try {
      const { error } = await db.storage
        .from(PHOTO_BUCKET)
        .upload(path, Buffer.from(base64, "base64"), { contentType: mime, upsert: false });
      if (error) {
        console.error("[leadStore] photo upload failed:", error.message);
        continue;
      }
      paths.push(path);
    } catch (err) {
      console.error("[leadStore] photo upload threw:", err);
    }
  }
  return paths;
}

/**
 * Swap storage paths for short-lived signed URLs so the admin can display
 * them. Generated per request and never persisted — a stored URL would
 * outlive its own expiry and turn into a broken image.
 */
export async function signPhotoUrls(paths: string[]): Promise<string[]> {
  const db = getClient();
  if (!db || paths.length === 0) return [];
  const { data, error } = await db.storage
    .from(PHOTO_BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
  if (error) {
    console.error("[leadStore] could not sign photo urls:", error.message);
    return [];
  }
  // createSignedUrls can return a null url per entry when one path fails.
  return (data ?? []).flatMap((d) => (d.signedUrl ? [d.signedUrl] : []));
}
