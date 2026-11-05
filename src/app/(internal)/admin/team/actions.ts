"use server";

import { revalidatePath } from "next/cache";
import { isSignedIn } from "@/lib/adminAuth";
import {
  createTeamMember,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  TEAM_ROLES,
  updateTeamMember,
  type TeamRole,
} from "@/lib/crm/team";

export type TeamFormState = { error?: string; ok?: boolean };

async function requireSession() {
  if (!(await isSignedIn())) throw new Error("Not authorised");
}

/** Ticked boxes become overrides only where they differ from the role's
    defaults, so changing a role later still moves everything it should. */
function readInput(formData: FormData) {
  const roleRaw = String(formData.get("role") ?? "crew");
  const role: TeamRole = (TEAM_ROLES as readonly string[]).includes(roleRaw) ? (roleRaw as TeamRole) : "crew";
  const permissions: Record<string, boolean> = {};
  if (formData.get("permissionsPosted")) {
    for (const key of PERMISSIONS) {
      const ticked = formData.get(`perm_${key}`) === "on";
      if (ticked !== ROLE_PERMISSIONS[role][key]) permissions[key] = ticked;
    }
  }
  return {
    displayName: String(formData.get("displayName") ?? ""),
    role,
    phone: String(formData.get("phone") ?? ""),
    initials: String(formData.get("initials") ?? ""),
    whatsappContactId: String(formData.get("whatsappContactId") ?? "") || null,
    permissions,
  };
}

export async function addTeamMemberAction(_prev: TeamFormState, formData: FormData): Promise<TeamFormState> {
  await requireSession();
  try {
    await createTeamMember(readInput(formData));
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not add them." };
  }
  revalidatePath("/admin/team");
  return { ok: true };
}

export async function updateTeamMemberAction(
  id: string,
  _prev: TeamFormState,
  formData: FormData,
): Promise<TeamFormState> {
  await requireSession();
  try {
    await updateTeamMember(id, { ...readInput(formData), active: formData.get("active") === "on" });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not save." };
  }
  revalidatePath("/admin/team");
  return { ok: true };
}
