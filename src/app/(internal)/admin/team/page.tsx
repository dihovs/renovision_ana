import { addTeamMemberAction, updateTeamMemberAction } from "./actions";
import AdminNotice from "@/components/admin/AdminNotice";
import TeamMemberForm from "@/components/admin/TeamMemberForm";
import { Card, ChevronIcon, SectionHeader, StatusPill } from "@/components/admin/ui/Hub";
import { isConfigured, MigrationPendingError } from "@/lib/crm/db";
import { listLinkableContacts, listTeamMembers, memberInitials, TEAM_ROLE_LABEL, type TeamMember } from "@/lib/crm/team";

export const dynamic = "force-dynamic";

/**
 * The team: who works here and what each person may do. Visits are assigned
 * to these people, and their hours are clocked against them.
 */
export default async function TeamPage() {
  if (!isConfigured) {
    return <AdminNotice title="No database connected yet">Set the Supabase environment variables to turn this on.</AdminNotice>;
  }

  let members: TeamMember[];
  try {
    members = await listTeamMembers({ includeInactive: true });
  } catch (err) {
    if (err instanceof MigrationPendingError) {
      return (
        <AdminNotice title="One migration left to run">
          Run <code className="font-mono text-brand-blue">supabase/migrations/0053_team_members.sql</code> in the
          Supabase SQL editor.
        </AdminNotice>
      );
    }
    throw err;
  }
  const contacts = await listLinkableContacts();

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <Card className="p-4 sm:p-5">
        <h2 className="mb-3 font-heading text-[15px] font-bold text-charcoal">Add someone</h2>
        <TeamMemberForm action={addTeamMemberAction} contacts={contacts} submitLabel="Add to team" />
      </Card>

      <Card>
        <SectionHeader title="Team" count={members.length} />
        {members.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-charcoal/45 sm:px-5">Nobody yet. Add yourself first, then your crew.</p>
        ) : (
          <ul className="divide-y divide-black/[0.05] border-t border-black/[0.05]">
            {members.map((member) => (
              <li key={member.id}>
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 hover:bg-black/[0.02] sm:px-5 [&::-webkit-details-marker]:hidden">
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        member.active ? "bg-brand-blue text-white" : "bg-black/[0.06] text-charcoal/40"
                      }`}
                    >
                      {memberInitials(member)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-charcoal">{member.display_name}</span>
                      {member.phone && <span className="block text-xs text-charcoal/45">{member.phone}</span>}
                    </span>
                    {!member.active && <StatusPill tone="grey">Inactive</StatusPill>}
                    <StatusPill tone={member.role === "crew" ? "grey" : "blue"}>{TEAM_ROLE_LABEL[member.role]}</StatusPill>
                    <span className="transition-transform group-open:rotate-90">
                      <ChevronIcon />
                    </span>
                  </summary>
                  <div className="px-4 pb-4 sm:px-5">
                    <TeamMemberForm
                      action={updateTeamMemberAction.bind(null, member.id)}
                      member={member}
                      contacts={contacts}
                      submitLabel="Save"
                    />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
