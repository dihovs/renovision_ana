"use client";

import { useActionState, useState } from "react";
import type { TeamFormState } from "@/app/(internal)/admin/team/actions";
import {
  effectivePermissions,
  PERMISSION_LABEL,
  PERMISSIONS,
  TEAM_ROLE_LABEL,
  TEAM_ROLES,
  type TeamMember,
  type TeamRole,
} from "@/lib/crm/teamTypes";

/**
 * Add or edit one team member. The permission boxes start from the role's
 * defaults and follow the role picker until one is ticked by hand; what is
 * stored is only the difference (see actions.ts).
 */
export default function TeamMemberForm({
  action,
  member,
  contacts,
  submitLabel,
}: {
  action: (prev: TeamFormState, formData: FormData) => Promise<TeamFormState>;
  member?: TeamMember;
  contacts: { id: string; label: string; opted_in: boolean }[];
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {} as TeamFormState);
  const [role, setRole] = useState<TeamRole>(member?.role ?? "crew");
  const [overrides, setOverrides] = useState(member?.permissions ?? {});
  const perms = effectivePermissions({ role, permissions: overrides });
  const input =
    "w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15";

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="permissionsPosted" value="1" />
      <div className="grid gap-2 sm:grid-cols-[1fr_6rem_10rem]">
        <input name="displayName" required defaultValue={member?.display_name} placeholder="Name" aria-label="Name" className={input} />
        <input name="initials" defaultValue={member?.initials ?? ""} placeholder="Initials" aria-label="Initials" maxLength={3} className={input} />
        <select
          name="role"
          value={role}
          onChange={(e) => {
            setRole(e.target.value as TeamRole);
            setOverrides({});
          }}
          aria-label="Role"
          className={input}
        >
          {TEAM_ROLES.map((r) => (
            <option key={r} value={r}>
              {TEAM_ROLE_LABEL[r]}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <input name="phone" type="tel" defaultValue={member?.phone ?? ""} placeholder="Phone" aria-label="Phone" className={input} />
        <select name="whatsappContactId" defaultValue={member?.whatsapp_contact_id ?? ""} aria-label="WhatsApp contact" className={input}>
          <option value="">No WhatsApp contact</option>
          {contacts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
              {c.opted_in ? "" : " (not opted in)"}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="rounded-xl bg-[#f6f8fb] p-3">
        <legend className="px-1 text-xs font-semibold text-charcoal/60">What they can do</legend>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {PERMISSIONS.map((key) => (
            <label key={key} className="flex items-center gap-2 text-sm text-charcoal/80">
              <input
                type="checkbox"
                name={`perm_${key}`}
                checked={perms[key]}
                onChange={(e) => setOverrides({ ...overrides, [key]: e.target.checked })}
                className="h-4 w-4 accent-brand-blue"
              />
              {PERMISSION_LABEL[key]}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        {member && (
          <label className="flex items-center gap-2 text-sm text-charcoal/70">
            <input type="checkbox" name="active" defaultChecked={member.active} className="h-4 w-4 accent-brand-blue" />
            Active
          </label>
        )}
        <button
          type="submit"
          disabled={pending}
          className="cursor-pointer rounded-xl bg-brand-blue px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-brand-blue/90 disabled:opacity-50"
        >
          {pending ? "Saving…" : submitLabel}
        </button>
        {state.error && <span className="text-sm text-red-700">{state.error}</span>}
        {state.ok && !pending && <span className="text-sm text-green-700">Saved.</span>}
      </div>
    </form>
  );
}
