import { randomUUID } from "crypto";
import { db, isMissingTable, MigrationPendingError } from "./db";
import { clientDisplayName } from "./types";

/**
 * Projects and their file library.
 *
 * A project is the container above jobs — "Dubois basement renovation" can
 * span several jobs and accumulates files the whole way: site photos, permits,
 * contracts, supplier receipts, plans. Files follow the lead-photo pattern
 * exactly: bytes in a PRIVATE Supabase Storage bucket, paths in the table,
 * short-lived signed URLs minted per request for the signed-in operator.
 */

export const PROJECT_STATUSES = ["active", "on_hold", "done", "archived"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  active: "Active",
  on_hold: "On hold",
  done: "Done",
  archived: "Archived",
};

export type Project = {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  client_id: string | null;
  status: ProjectStatus;
  description: string | null;
  started_on: string | null;
  archived_at: string | null;
};

export type ProjectFile = {
  id: string;
  project_id: string;
  storage_path: string;
  filename: string;
  size_bytes: number;
  content_type: string;
  note: string | null;
  uploaded_at: string;
};

export type ProjectListItem = Project & {
  client_name: string | null;
  file_count: number;
  /** The later of the project's own updated_at and its newest upload. */
  last_activity: string;
  /** How many rooms have been measured, and the geometry of the largest —
      enough for the card to show a floor plan rather than a grey box. A
      scan-less project simply has null here. */
  room_count: number;
  largest_room: { name: string; geometry: Record<string, unknown> } | null;
  floor_area_sqm: number;
};

/** A job linked to the project — display fields only; jobs stay read-only here. */
export type AttachedJob = {
  id: string;
  job_number: number;
  title: string | null;
  status: string;
};

export type ProjectQuote = {
  id: string;
  quote_number: number;
  title: string | null;
  status: string;
  total_cents: number;
};

export type ProjectDetail = Project & {
  client: { id: string; name: string } | null;
  files: ProjectFile[];
  jobs: AttachedJob[];
  /** Newest first. Estimates built under this project — the other half of
      "project → estimate → job → invoice", alongside the jobs above. */
  quotes: ProjectQuote[];
};

/** Bucket is private; files are only ever reachable via a signed URL. */
const FILE_BUCKET = "project-files";
/** Same lifetime as lead photos: long enough to read on site, short enough
 *  that a copied link dies. */
const SIGNED_URL_TTL_SECONDS = 60 * 60;

/**
 * Per-file upload cap. Uploads go one file per request through a route
 * handler, and Vercel rejects request bodies over ~4.5 MB before our code
 * runs — so 4 MB is the honest ceiling, leaving room for multipart overhead.
 * (A server action was ruled out: their body limit defaults to 1 MB and
 * raising it is a next.config change this feature must not own.)
 */
export const MAX_PROJECT_FILE_BYTES = 4 * 1024 * 1024;

function requireDb() {
  const client = db();
  if (!client) throw new Error("Database is not configured");
  return client;
}

/** Empty string from a form input means "not provided", not "set to blank". */
function orNull(value: string | undefined | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Make an uploaded filename safe as a storage key and a display string.
 *
 * The browser's filename is untrusted input: it can carry path separators,
 * control characters and unicode that storage keys reject. Diacritics are
 * flattened (é → e) so keys stay ASCII, and the extension is preserved
 * because it is the part the crew recognises a file by.
 */
export function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const cleaned = base
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w.\- ]+/g, "_")
    .replace(/\s+/g, " ")
    .trim();
  const dot = cleaned.lastIndexOf(".");
  const ext = dot > 0 ? cleaned.slice(dot).slice(0, 12) : "";
  const stem = (dot > 0 ? cleaned.slice(0, dot) : cleaned).slice(0, 100).trim();
  return `${stem || "file"}${ext}`;
}

/** The browser's MIME claim, kept only if it looks like a MIME type. */
export function sanitizeContentType(type: string | undefined | null): string {
  const t = (type ?? "").trim().toLowerCase();
  return /^[\w!#$&^.+-]+\/[\w!#$&^.+-]+$/.test(t) && t.length <= 120
    ? t
    : "application/octet-stream";
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * Project list, most recently touched first.
 *
 * Without a status filter, archived projects are excluded — same convention
 * as every other list in the CRM. The Archived chip passes the status
 * explicitly, which is the one way to see them.
 */
export async function listProjects(
  options: { status?: ProjectStatus; limit?: number } = {},
): Promise<ProjectListItem[]> {
  const client = requireDb();
  const { status, limit = 200 } = options;

  let query = client
    .from("projects")
    .select(
      "*, clients(first_name, last_name, company_name), project_files(uploaded_at), " +
        "room_scans(name, floor_area_sqm, geometry)",
    )
    .order("updated_at", { ascending: false })
    .limit(limit);

  query = status ? query.eq("status", status) : query.neq("status", "archived");

  const { data, error } = await query;
  if (error) {
    if (isMissingTable(error)) throw new MigrationPendingError("projects");
    throw new Error(`Could not load projects: ${error.message}`);
  }

  return ((data ?? []) as unknown as (Project & {
    clients: Parameters<typeof clientDisplayName>[0] | null;
    project_files: { uploaded_at: string }[];
    room_scans: { name: string; floor_area_sqm: number; geometry: Record<string, unknown> }[] | null;
  })[]).map(({ clients, project_files, room_scans, ...project }) => {
    const uploads = (project_files ?? []).map((f) => f.uploaded_at);
    // ISO timestamps sort lexicographically, so a plain sort finds the newest.
    const last = [project.updated_at, ...uploads].sort().pop() ?? project.updated_at;
    // The biggest room is the one that identifies a property at a glance —
    // a card showing the broom cupboard would be technically a floor plan
    // and useless as a thumbnail.
    const scans = room_scans ?? [];
    const largest = scans.reduce<(typeof scans)[number] | null>(
      (best, scan) => (!best || Number(scan.floor_area_sqm) > Number(best.floor_area_sqm) ? scan : best),
      null,
    );

    return {
      ...project,
      client_name: clients ? clientDisplayName(clients) : null,
      file_count: uploads.length,
      last_activity: last,
      room_count: scans.length,
      largest_room: largest ? { name: largest.name, geometry: largest.geometry } : null,
      floor_area_sqm: scans.reduce((sum, scan) => sum + Number(scan.floor_area_sqm), 0),
    };
  });
}

export async function getProject(id: string): Promise<ProjectDetail | null> {
  const client = requireDb();
  const { data, error } = await client
    .from("projects")
    .select(
      "*, clients(id, first_name, last_name, company_name), project_files(*), " +
        "project_jobs(job_id, jobs(id, job_number, title, status)), " +
        "quotes(id, quote_number, title, status, total_cents, archived_at)",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    if (isMissingTable(error)) throw new MigrationPendingError("projects");
    throw new Error(`Could not load the project: ${error.message}`);
  }
  if (!data) return null;

  const row = data as unknown as Project & {
    clients: ({ id: string } & Parameters<typeof clientDisplayName>[0]) | null;
    project_files: ProjectFile[];
    project_jobs: { job_id: string; jobs: AttachedJob | null }[];
    quotes: (ProjectQuote & { archived_at: string | null })[];
  };

  return {
    ...row,
    client: row.clients ? { id: row.clients.id, name: clientDisplayName(row.clients) } : null,
    // Newest first: the file just uploaded is the one being looked for.
    files: (row.project_files ?? []).sort((a, b) =>
      b.uploaded_at.localeCompare(a.uploaded_at),
    ),
    jobs: (row.project_jobs ?? [])
      .flatMap((link) => (link.jobs ? [link.jobs] : []))
      .sort((a, b) => b.job_number - a.job_number),
    quotes: (row.quotes ?? [])
      .filter((q) => !q.archived_at)
      .sort((a, b) => b.quote_number - a.quote_number),
  };
}

/**
 * Recent jobs that could be attached — everything not archived and not
 * already on this project. Filtered in memory: 100 recent jobs is small, and
 * a `not in` clause with a long uuid list is where query strings go to die.
 */
export async function listAttachableJobs(
  excludeIds: string[],
): Promise<{ id: string; label: string }[]> {
  const client = requireDb();
  const { data, error } = await client
    .from("jobs")
    .select("id, job_number, title, clients(first_name, last_name, company_name)")
    .is("archived_at", null)
    .order("job_number", { ascending: false })
    .limit(100);

  if (error) {
    if (isMissingTable(error)) throw new MigrationPendingError("jobs");
    throw new Error(`Could not load jobs: ${error.message}`);
  }

  const excluded = new Set(excludeIds);
  return ((data ?? []) as unknown as {
    id: string;
    job_number: number;
    title: string | null;
    clients: Parameters<typeof clientDisplayName>[0] | null;
  }[])
    .filter((job) => !excluded.has(job.id))
    .map((job) => ({
      id: job.id,
      label: `#${job.job_number} — ${
        job.title || (job.clients ? clientDisplayName(job.clients) : "Untitled job")
      }`,
    }));
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export async function createProject(input: {
  name: string;
  clientId?: string | null;
  description?: string | null;
  startedOn?: string | null;
}): Promise<string> {
  const client = requireDb();

  const name = input.name.trim();
  if (!name) throw new Error("Give the project a name.");

  const { data, error } = await client
    .from("projects")
    .insert({
      name: name.slice(0, 200),
      client_id: input.clientId || null,
      description: orNull(input.description)?.slice(0, 10_000) ?? null,
      started_on: input.startedOn || null,
    })
    .select("id")
    .single();

  if (error) {
    if (isMissingTable(error)) throw new MigrationPendingError("projects");
    throw new Error(`Could not create the project: ${error.message}`);
  }
  return data.id as string;
}

export async function updateProjectStatus(id: string, status: ProjectStatus): Promise<void> {
  const client = requireDb();
  const { error } = await client
    .from("projects")
    .update({
      status,
      // archived_at tracks the status so "when was it put away" survives a
      // later correction; any other status is a restore.
      archived_at: status === "archived" ? new Date().toISOString() : null,
    })
    .eq("id", id);
  if (error) throw new Error(`Could not update the project: ${error.message}`);
}

export async function attachJob(projectId: string, jobId: string): Promise<void> {
  const client = requireDb();
  const { error } = await client
    .from("project_jobs")
    .insert({ project_id: projectId, job_id: jobId });
  if (error) {
    // 23505 is unique_violation: already attached, which on a double-tapped
    // button is success, not failure.
    if (error.code === "23505") return;
    if (isMissingTable(error)) throw new MigrationPendingError("project_jobs");
    throw new Error(`Could not attach the job: ${error.message}`);
  }
}

export async function detachJob(projectId: string, jobId: string): Promise<void> {
  const client = requireDb();
  const { error } = await client
    .from("project_jobs")
    .delete()
    .eq("project_id", projectId)
    .eq("job_id", jobId);
  if (error) throw new Error(`Could not detach the job: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------

/**
 * Store one file: bytes to the private bucket, then the metadata row.
 *
 * The size recorded is the byte length actually received, never the browser's
 * claim. If the row insert fails after the upload succeeded, the object is
 * removed again — an orphan blob in a private bucket is invisible, and
 * invisible storage is a bill nobody can explain.
 */
export async function addProjectFile(
  projectId: string,
  input: { bytes: Buffer; filename: string; contentType?: string | null; note?: string | null },
): Promise<string> {
  const client = requireDb();

  const filename = sanitizeFilename(input.filename);
  const contentType = sanitizeContentType(input.contentType);
  const path = `${projectId}/${randomUUID()}-${filename}`;

  const { error: uploadError } = await client.storage
    .from(FILE_BUCKET)
    .upload(path, input.bytes, { contentType, upsert: false });
  if (uploadError) {
    throw new Error(`Could not store the file: ${uploadError.message}`);
  }

  const { data, error } = await client
    .from("project_files")
    .insert({
      project_id: projectId,
      storage_path: path,
      filename,
      size_bytes: input.bytes.byteLength,
      content_type: contentType,
      note: orNull(input.note),
    })
    .select("id")
    .single();

  if (error) {
    await client.storage
      .from(FILE_BUCKET)
      .remove([path])
      .catch(() => undefined);
    if (isMissingTable(error)) throw new MigrationPendingError("project_files");
    throw new Error(`Could not record the file: ${error.message}`);
  }

  // Touch the project so the list's "last activity" reflects the upload.
  await client
    .from("projects")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", projectId);

  return data.id as string;
}

/**
 * Delete a file: row first, object second.
 *
 * Ordered this way deliberately. If the object went first and the row delete
 * failed, the screen would show a file whose download is broken. The reverse
 * failure — row gone, object orphaned — is invisible and logged.
 */
export async function deleteProjectFile(fileId: string): Promise<void> {
  const client = requireDb();

  const { data, error } = await client
    .from("project_files")
    .select("id, storage_path")
    .eq("id", fileId)
    .maybeSingle();
  if (error) throw new Error(`Could not find the file: ${error.message}`);
  // Already gone: a double-tapped delete is success, not failure.
  if (!data) return;

  const { error: rowError } = await client.from("project_files").delete().eq("id", fileId);
  if (rowError) throw new Error(`Could not delete the file: ${rowError.message}`);

  const { error: storageError } = await client.storage
    .from(FILE_BUCKET)
    .remove([data.storage_path as string]);
  if (storageError) {
    console.error("[projects] file row deleted but object removal failed:", storageError.message);
  }
}

/**
 * Swap storage paths for short-lived signed URLs, keyed by path.
 *
 * Generated per request and never persisted, same as lead photos — a stored
 * URL would outlive its own expiry and turn into a broken link. Paths that
 * fail to sign are simply absent from the result; the UI renders those
 * unlinked rather than broken.
 */
export async function signProjectFileUrls(paths: string[]): Promise<Record<string, string>> {
  const client = db();
  if (!client || paths.length === 0) return {};
  const { data, error } = await client.storage
    .from(FILE_BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
  if (error) {
    console.error("[projects] could not sign file urls:", error.message);
    return {};
  }
  const out: Record<string, string> = {};
  for (const entry of data ?? []) {
    if (entry.path && entry.signedUrl) out[entry.path] = entry.signedUrl;
  }
  return out;
}
