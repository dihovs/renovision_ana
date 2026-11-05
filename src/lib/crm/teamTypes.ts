/**
 * Team roles and permissions — pure, no database, so client components
 * (the team form) can import them. The database side is team.ts.
 */

export const TEAM_ROLES = ["owner", "manager", "crew"] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];

export const TEAM_ROLE_LABEL: Record<TeamRole, string> = {
  owner: "Owner",
  manager: "Manager",
  crew: "Crew",
};

/** What a person may do. Keys are stable — they are stored as overrides. */
export const PERMISSIONS = [
  "see_prices",
  "collect_payment",
  "edit_schedule",
  "approve_time",
  "edit_checklists",
  "fill_checklists",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const PERMISSION_LABEL: Record<Permission, string> = {
  see_prices: "See prices and totals",
  collect_payment: "Collect payment",
  edit_schedule: "Book and move visits",
  approve_time: "Approve timesheets",
  edit_checklists: "Build checklist templates",
  fill_checklists: "Fill in checklists on site",
};

/** The role's defaults. Crew never see prices — the crew page's rule since
    0020, kept here so a role cannot quietly widen it. */
export const ROLE_PERMISSIONS: Record<TeamRole, Record<Permission, boolean>> = {
  owner: {
    see_prices: true,
    collect_payment: true,
    edit_schedule: true,
    approve_time: true,
    edit_checklists: true,
    fill_checklists: true,
  },
  manager: {
    see_prices: true,
    collect_payment: true,
    edit_schedule: true,
    approve_time: true,
    edit_checklists: true,
    fill_checklists: true,
  },
  crew: {
    see_prices: false,
    collect_payment: false,
    edit_schedule: false,
    approve_time: false,
    edit_checklists: false,
    fill_checklists: true,
  },
};

export type TeamMember = {
  id: string;
  created_at: string;
  updated_at: string;
  display_name: string;
  role: TeamRole;
  permissions: Partial<Record<Permission, boolean>>;
  phone: string | null;
  person_id: string | null;
  whatsapp_contact_id: string | null;
  initials: string | null;
  active: boolean;
};

/** The role's defaults with this person's overrides on top. */
export function effectivePermissions(member: Pick<TeamMember, "role" | "permissions">): Record<Permission, boolean> {
  const base = ROLE_PERMISSIONS[member.role] ?? ROLE_PERMISSIONS.crew;
  const out = { ...base };
  for (const key of PERMISSIONS) {
    const override = member.permissions?.[key];
    if (typeof override === "boolean") out[key] = override;
  }
  return out;
}

export function can(member: Pick<TeamMember, "role" | "permissions">, permission: Permission): boolean {
  return effectivePermissions(member)[permission];
}

/** "Jean-Marc Roy" → "JR", unless the member has their own. */
export function memberInitials(member: Pick<TeamMember, "display_name" | "initials">): string {
  if (member.initials?.trim()) return member.initials.trim().toUpperCase();
  const parts = member.display_name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "?";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

