import { saveTemplateAction } from "./actions";
import AdminNotice from "@/components/admin/AdminNotice";
import ChecklistBuilder from "@/components/admin/ChecklistBuilder";
import { Card, HubList, HubRow, SectionHeader } from "@/components/admin/ui/Hub";
import { listTemplates, type ChecklistTemplate } from "@/lib/crm/checklists";
import { isConfigured, MigrationPendingError } from "@/lib/crm/db";

export const dynamic = "force-dynamic";

/** Checklist templates: build once, attach to any job or visit. */
export default async function ChecklistsPage() {
  if (!isConfigured) {
    return <AdminNotice title="No database connected yet">Set the Supabase environment variables to turn this on.</AdminNotice>;
  }
  let templates: ChecklistTemplate[];
  try {
    templates = await listTemplates();
  } catch (err) {
    if (err instanceof MigrationPendingError) {
      return (
        <AdminNotice title="One migration left to run">
          Run <code className="font-mono text-brand-blue">supabase/migrations/0056_checklist_templates.sql</code> in the
          Supabase SQL editor (after 0053–0055).
        </AdminNotice>
      );
    }
    throw err;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <Card>
        <SectionHeader title="Checklists" count={templates.length} />
        {templates.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-charcoal/45 sm:px-5">None yet. Build the first one below.</p>
        ) : (
          <HubList>
            {templates.map((t) => {
              const fields = t.sections.reduce((n, s) => n + s.fields.length, 0);
              return (
                <HubRow
                  key={t.id}
                  href={`/admin/checklists/${t.id}`}
                  title={t.name}
                  subtitle={t.description}
                  meta={`${t.sections.length} section${t.sections.length === 1 ? "" : "s"} · ${fields} fields`}
                />
              );
            })}
          </HubList>
        )}
      </Card>

      <h2 className="px-1 pt-2 font-heading text-[15px] font-bold text-charcoal">New checklist</h2>
      <ChecklistBuilder initial={{ name: "", description: "", sections: [] }} save={saveTemplateAction.bind(null, null)} />
    </div>
  );
}
