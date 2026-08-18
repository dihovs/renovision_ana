import { randomUUID } from "crypto";
import { db, isEmbedFailure, isMissingTable, MigrationPendingError } from "./db";
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
  /** Who the job was handed to. Free text by design — see migration 0035;
      there is no staff table and deliberately so. Null means nobody yet,
      which is not the same as an empty name. */
  assigned_to: string | null;
  is_favorite: boolean;
  /** Answers to the project-level custom fields — the claim details, when
      the claim template has been applied. { fieldId: value }. */
  custom: Record<string, string>;
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

/** The survey figures for the whole property, and per storey — what the
    statistics band and the floor-plan sections are built from. */
export type ProjectSurvey = {
  rooms: {
    id: string;
    name: string;
    level: string;
    floorAreaSqm: number;
    wallLengthM: number;
    ceilingHeightM: number;
    stairCount: number;
    geometry: Record<string, unknown>;
  }[];
  levels: string[];
  floorAreaSqm: number;
  /** Perimeter × ceiling height, summed per room — paint and drywall are
      priced off this, and it is the one headline figure that cannot be
      derived from floor area. */
  wallAreaSqm: number;
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

  /**
   * Built twice on purpose. The rich form embeds the client, the files and
   * the scans; the plain form embeds nothing. If PostgREST cannot resolve one
   * of those relationships — a stale schema cache after a migration is the
   * usual reason — the projects themselves are still perfectly readable, and
   * a project list that refuses to load because a thumbnail join failed is a
   * far worse outcome than a list without thumbnails.
   */
  const build = (select: string) => {
    const q = client
      .from("projects")
      .select(select)
      .order("updated_at", { ascending: false })
      .limit(limit);
    return status ? q.eq("status", status) : q.neq("status", "archived");
  };

  const RICH =
    "*, clients(first_name, last_name, company_name), project_files(uploaded_at), " +
    "room_scans(name, floor_area_sqm, geometry)";

  let { data, error } = await build(RICH);

  if (error && isEmbedFailure(error)) {
    // Degrade rather than fail: names, statuses and dates are what the list
    // is actually for.
    console.warn("[projects] embed failed, falling back to a plain list", error.message);
    ({ data, error } = await build("*"));
  }

  if (error) {
    if (isMissingTable(error)) throw new MigrationPendingError("projects", error.message);
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

/**
 * Everything measured on a property, totalled.
 *
 * Separate from `getProject` because it degrades on its own: a database
 * without migration 0024 should grey out the survey band, not take down the
 * whole project page — the same rule the dashboard's cards follow.
 */
export async function getProjectSurvey(projectId: string): Promise<ProjectSurvey> {
  const client = requireDb();
  const { data, error } = await client
    .from("room_scans")
    .select("id, name, level, floor_area_sqm, wall_length_m, ceiling_height_m, stair_count, geometry")
    .eq("project_id", projectId)
    .order("level", { ascending: true })
    .order("position", { ascending: true });

  if (error) {
    if (isMissingTable(error)) throw new MigrationPendingError("room_scans", error.message);
    throw new Error(`Could not load the survey: ${error.message}`);
  }

  const rooms = ((data ?? []) as unknown as {
    id: string;
    name: string;
    level: string;
    floor_area_sqm: number;
    wall_length_m: number;
    ceiling_height_m: number;
    stair_count: number;
    geometry: Record<string, unknown>;
  }[]).map((row) => ({
    id: row.id,
    name: row.name,
    level: row.level,
    floorAreaSqm: Number(row.floor_area_sqm),
    wallLengthM: Number(row.wall_length_m),
    ceilingHeightM: Number(row.ceiling_height_m),
    stairCount: row.stair_count,
    geometry: row.geometry,
  }));

  const levels: string[] = [];
  for (const room of rooms) if (!levels.includes(room.level)) levels.push(room.level);

  return {
    rooms,
    levels,
    floorAreaSqm: rooms.reduce((sum, r) => sum + r.floorAreaSqm, 0),
    wallAreaSqm: rooms.reduce((sum, r) => sum + r.wallLengthM * r.ceilingHeightM, 0),
  };
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
    if (isMissingTable(error)) throw new MigrationPendingError("projects", error.message);
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
    if (isMissingTable(error)) throw new MigrationPendingError("jobs", error.message);
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
    if (isMissingTable(error)) throw new MigrationPendingError("projects", error.message);
    throw new Error(`Could not create the project: ${error.message}`);
  }
  return data.id as string;
}

/**
 * Save the project's custom-field answers — the claim details.
 *
 * Replaces the whole bag rather than merging keys: the form posts every
 * field it knows about, including the conditionally hidden ones, so a
 * partial write here would be the form's bug rather than a feature.
 */
export async function updateProjectCustom(
  id: string,
  custom: Record<string, string>,
): Promise<void> {
  const client = requireDb();
  const { error } = await client
    .from("projects")
    .update({ custom, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    if (isMissingTable(error)) throw new MigrationPendingError("projects.custom", error.message);
    throw new Error(`Could not save the claim details: ${error.message}`);
  }
}

/**
 * Hand the job to somebody — the phone's `Move`.
 *
 * A name, not an id: there is no staff table and 0035 explains why. An empty
 * or whitespace-only name clears the assignment rather than storing a blank,
 * so "unassign" needs no separate call.
 */
export async function assignProject(id: string, person: string | null): Promise<void> {
  const client = requireDb();
  const trimmed = person?.trim();
  const { error } = await client
    .from("projects")
    .update({ assigned_to: trimmed ? trimmed : null, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    if (isMissingTable(error)) {
      throw new MigrationPendingError("projects.assigned_to", error.message);
    }
    throw new Error(`Could not assign the project: ${error.message}`);
  }
}

/**
 * Names already used, newest first — what the assign picker offers.
 *
 * DISTINCT over the column itself rather than a second table: the list of
 * people cannot then drift out of step with who has actually been assigned,
 * and nobody has to maintain a roster to make the picker useful.
 */
export async function listAssignees(): Promise<string[]> {
  const client = requireDb();
  const { data, error } = await client
    .from("projects")
    .select("assigned_to, updated_at")
    .not("assigned_to", "is", null)
    .order("updated_at", { ascending: false })
    .limit(200);
  // A picker that cannot offer suggestions is still a picker you can type
  // into, so this degrades to empty rather than taking the sheet down.
  if (error) return [];
  const seen = new Set<string>();
  for (const row of (data ?? []) as { assigned_to: string | null }[]) {
    const name = row.assigned_to?.trim();
    if (name) seen.add(name);
  }
  return [...seen];
}

/**
 * Star or unstar a project.
 *
 * `updated_at` is deliberately PRESERVED across this write. The list is
 * ordered by it — "what has been worked on lately" — and a star is a
 * bookmark the operator puts on a job, not work done to it. Bumping the
 * stamp shuffled a starred job to the top of the grid as though somebody had
 * just measured it: a lie about the job, and a card moving out from under
 * the thumb that was aiming at it.
 *
 * The value has to be written back explicitly rather than simply left alone,
 * because `projects_touch_updated_at` (migration 0015) fires BEFORE UPDATE on
 * every row and would otherwise stamp it regardless.
 */
export async function setProjectFavorite(id: string, favorite: boolean): Promise<void> {
  const client = requireDb();

  const { data: before } = await client
    .from("projects")
    .select("updated_at")
    .eq("id", id)
    .maybeSingle();
  const stamp = (before as { updated_at?: string } | null)?.updated_at;

  const { error } = await client
    .from("projects")
    // Falling back to no stamp at all if the read failed is right: losing the
    // ordering on one card is a smaller fault than refusing to star it.
    .update(stamp ? { is_favorite: favorite, updated_at: stamp } : { is_favorite: favorite })
    .eq("id", id);
  if (error) {
    if (isMissingTable(error)) {
      throw new MigrationPendingError("projects.is_favorite", error.message);
    }
    throw new Error(`Could not star the project: ${error.message}`);
  }
}

/**
 * Copy a project's LAYOUT onto a new job — the phone's `Duplicate`.
 *
 * # What is copied, and the one rule behind it
 *
 * Rooms, their geometry, their plan positions and their per-wall details
 * (load-bearing, elevation flags, thickness). In other words: the drawing.
 * The case this exists for is a second unit in the same building, or the
 * same layout re-measured for a new claim — the shape is the expensive part
 * to capture and the part worth reusing.
 *
 * # What is deliberately NOT copied, and why that is not a shortcut
 *
 * Moisture readings, equipment placements, photos and files, affected areas,
 * and any attached job.
 *
 * These are EVIDENCE. A drying log is a dated record that somebody stood in
 * that building and read those numbers off an instrument; equipment
 * placements are unit-days that get billed; photos are what an adjuster looks
 * at. Copying any of them into a different job would put readings, charges
 * and pictures into a claim file for a property where they never happened.
 * That is not a duplicate, it is a fabricated record — so the copy starts
 * with an empty drying log and no photos, which is the honest state of a job
 * nobody has visited yet.
 *
 * Affected areas go with the evidence rather than with the layout for the
 * same reason: where the water reached is a fact about one incident, not a
 * property of the building's shape.
 *
 * Returns the new project's id.
 */
export async function duplicateProject(id: string): Promise<string> {
  const client = requireDb();

  const { data: source, error: readError } = await client
    .from("projects")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (readError) throw new Error(`Could not read the project: ${readError.message}`);
  if (!source) throw new Error("That project no longer exists.");

  const original = source as Project;
  const { data: made, error: createError } = await client
    .from("projects")
    .insert({
      name: `${original.name} copy`,
      client_id: original.client_id,
      description: original.description,
      custom: original.custom ?? {},
      assigned_to: original.assigned_to ?? null,
      // A copy is a job nobody has started: it is active, not archived, and
      // not starred just because its source was.
      status: "active",
      is_favorite: false,
    })
    .select("id")
    .single();
  if (createError) throw new Error(`Could not create the copy: ${createError.message}`);
  const newId = (made as { id: string }).id;

  const { data: scans, error: scanError } = await client
    .from("room_scans")
    .select("*")
    .eq("project_id", id);
  // The project itself exists by now; a room read that fails leaves an empty
  // copy rather than a half-built one, and says so.
  if (scanError) throw new Error(`The project was copied, but its rooms were not: ${scanError.message}`);

  const rooms = (scans ?? []) as (Record<string, unknown> & { id: string })[];
  if (rooms.length === 0) return newId;

  const { data: insertedRooms, error: roomError } = await client
    .from("room_scans")
    .insert(
      rooms.map((room) => ({
        project_id: newId,
        name: room.name,
        level: room.level,
        position: room.position,
        floor_area_sqm: room.floor_area_sqm,
        wall_length_m: room.wall_length_m,
        ceiling_height_m: room.ceiling_height_m,
        door_count: room.door_count,
        window_count: room.window_count,
        stair_count: room.stair_count,
        geometry: room.geometry,
        notes: room.notes,
        plan_x: room.plan_x,
        plan_y: room.plan_y,
        room_type: room.room_type,
        living_percent: room.living_percent,
        room_color: room.room_color,
      })),
    )
    .select("id");
  if (roomError) throw new Error(`The project was copied, but its rooms were not: ${roomError.message}`);

  // Wall details ride along with the walls they describe. Rows come back in
  // insert order, which is what pairs each new room with the one it came
  // from; anything else would attach a load-bearing flag to the wrong wall.
  const newRoomIds = ((insertedRooms ?? []) as { id: string }[]).map((r) => r.id);
  if (newRoomIds.length !== rooms.length) return newId;

  const { data: walls } = await client
    .from("room_walls")
    .select("*")
    .in("room_scan_id", rooms.map((r) => r.id));

  const wallRows = (walls ?? []) as (Record<string, unknown> & { room_scan_id: string })[];
  if (wallRows.length > 0) {
    const remap = new Map(rooms.map((room, index) => [room.id, newRoomIds[index]]));
    const copies = wallRows
      .map((wall) => {
        const target = remap.get(wall.room_scan_id);
        return target
          ? {
              room_scan_id: target,
              wall_index: wall.wall_index,
              load_bearing: wall.load_bearing,
              display_elevation: wall.display_elevation,
              notes: wall.notes,
            }
          : null;
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);
    // Wall flags are a convenience, not the drawing — losing them must not
    // fail a copy whose rooms already landed.
    if (copies.length > 0) await client.from("room_walls").insert(copies);
  }

  return newId;
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
    if (isMissingTable(error)) throw new MigrationPendingError("project_jobs", error.message);
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
  input: {
    bytes: Buffer;
    filename: string;
    contentType?: string | null;
    note?: string | null;
    /** Pin this photo to one room, and optionally to one damaged area
        inside it. Both null means an ordinary project file — a permit, a
        receipt — which is what every existing row is. */
    roomScanId?: string | null;
    affectedAreaId?: string | null;
    /** Pin a room photo to one wall of it as well — the wall's own photos,
        not the room's general pile. Nullable, like the rest of these. */
    wallIndex?: number | null;
  },
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
      room_scan_id: input.roomScanId ?? null,
      affected_area_id: input.affectedAreaId ?? null,
      wall_index: input.wallIndex ?? null,
    })
    .select("id")
    .single();

  if (error) {
    await client.storage
      .from(FILE_BUCKET)
      .remove([path])
      .catch(() => undefined);
    if (isMissingTable(error)) throw new MigrationPendingError("project_files", error.message);
    throw new Error(`Could not record the file: ${error.message}`);
  }

  // Touch the project so the list's "last activity" reflects the upload.
  await client
    .from("projects")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", projectId);

  return data.id as string;
}

/** One room's photos, newest first — what a report page is built from.
    `wallIndex` narrows to one wall's own photos; omitted, every photo filed
    against the room comes back, wall ones included, which is what the
    report and the room's own grid have always wanted. */
export async function listRoomFiles(
  roomScanId: string,
  wallIndex?: number,
): Promise<ProjectFile[]> {
  const client = requireDb();
  let query = client.from("project_files").select("*").eq("room_scan_id", roomScanId);
  if (wallIndex !== undefined) query = query.eq("wall_index", wallIndex);
  const { data, error } = await query.order("uploaded_at", { ascending: false });
  if (error) {
    if (isMissingTable(error)) throw new MigrationPendingError("project_files", error.message);
    throw new Error(`Could not load the photos: ${error.message}`);
  }
  return (data ?? []) as ProjectFile[];
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
