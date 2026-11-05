import { db, isMissingTable, MigrationPendingError } from "./db";
import { PERMISSIONS, TEAM_ROLES, type Permission, type TeamMember, type TeamRole } from "./teamTypes";

export * from "./teamTypes";

/**
 * The team — who works, in what role (migration 0053).
 *
 * A team member is not a login. It is who a visit is assigned to and whose
 * hours a time entry counts. Crew still reach their work through the per-job
 * crew link; the admin still has one password.
 */

function requireDb() {
  const client = db();
  if (!client) throw new Error("Database is not configured");
  return client;
}

function fail(error: { message: string }, what: string): never {
  if (isMissingTable(error)) throw new MigrationPendingError("team_members", error.message);
  throw new Error(`Could not ${what}: ${error.message}`);
}

function normaliseRole(value: string | null | undefined): TeamRole {
  return (TEAM_ROLES as readonly string[]).includes(value ?? "") ? (value as TeamRole) : "crew";
}

/** Only the known keys, only booleans — anything else is dropped. */
export function cleanPermissions(input: Record<string, unknown> | null | undefined): Partial<Record<Permission, boolean>> {
  const out: Partial<Record<Permission, boolean>> = {};
  for (const key of PERMISSIONS) {
    const value = input?.[key];
    if (typeof value === "boolean") out[key] = value;
  }
  return out;
}

export async function listTeamMembers(options: { includeInactive?: boolean } = {}): Promise<TeamMember[]> {
  const client = requireDb();
  let query = client.from("team_members").select("*").order("display_name");
  if (!options.includeInactive) query = query.eq("active", true);
  const { data, error } = await query;
  if (error) fail(error, "load the team");
  return (data ?? []) as TeamMember[];
}

export async function getTeamMember(id: string): Promise<TeamMember | null> {
  const client = requireDb();
  const { data, error } = await client.from("team_members").select("*").eq("id", id).maybeSingle();
  if (error) fail(error, "load the team member");
  return (data as TeamMember | null) ?? null;
}

export type TeamMemberInput = {
  displayName: string;
  role: string;
  phone?: string | null;
  initials?: string | null;
  whatsappContactId?: string | null;
  permissions?: Record<string, unknown>;
  active?: boolean;
};

function toRow(input: TeamMemberInput) {
  const name = input.displayName.trim();
  if (!name) throw new Error("Give the team member a name.");
  return {
    display_name: name.slice(0, 120),
    role: normaliseRole(input.role),
    phone: input.phone?.trim() || null,
    initials: input.initials?.trim().slice(0, 3).toUpperCase() || null,
    whatsapp_contact_id: input.whatsappContactId || null,
    permissions: cleanPermissions(input.permissions),
    ...(input.active === undefined ? {} : { active: input.active }),
  };
}

export async function createTeamMember(input: TeamMemberInput): Promise<string> {
  const client = requireDb();
  const { data, error } = await client.from("team_members").insert(toRow(input)).select("id").single();
  if (error) fail(error, "add the team member");
  return data.id as string;
}

export async function updateTeamMember(id: string, input: TeamMemberInput): Promise<void> {
  const client = requireDb();
  const { error } = await client.from("team_members").update(toRow(input)).eq("id", id);
  if (error) fail(error, "save the team member");
}

/** WhatsApp contacts that can be linked to a member — the people dispatch
    already reaches. Archived contacts are left out. */
export async function listLinkableContacts(): Promise<{ id: string; label: string; opted_in: boolean }[]> {
  const client = requireDb();
  const { data, error } = await client
    .from("whatsapp_contacts")
    .select("id, wa_id, profile_name, display_name, opted_in_at")
    .is("archived_at", null)
    .order("display_name");
  if (error) return [];
  return (data ?? []).map((c) => ({
    id: c.id as string,
    label: (c.display_name || c.profile_name || `+${c.wa_id}`) as string,
    opted_in: Boolean(c.opted_in_at),
  }));
}
