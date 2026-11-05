import Link from "next/link";
import { notFound } from "next/navigation";
import { archiveTemplateAction, saveTemplateAction } from "../actions";
import ChecklistBuilder from "@/components/admin/ChecklistBuilder";
import { getTemplate } from "@/lib/crm/checklists";

export const dynamic = "force-dynamic";

export default async function ChecklistTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const template = await getTemplate(id);
  if (!template) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <div className="flex items-center justify-between">
        <Link href="/admin/checklists" className="text-sm font-semibold text-charcoal/50 hover:text-charcoal">
          ‹ Checklists
        </Link>
        <form action={archiveTemplateAction.bind(null, template.id, true)}>
          <button type="submit" className="cursor-pointer text-sm font-semibold text-charcoal/40 hover:text-red-600">
            Archive
          </button>
        </form>
      </div>
      <p className="px-1 text-xs text-charcoal/45">
        Changes apply the next time this checklist is attached. Jobs that already have it keep the copy they were given.
      </p>
      <ChecklistBuilder
        initial={{ name: template.name, description: template.description ?? "", sections: template.sections }}
        save={saveTemplateAction.bind(null, template.id)}
      />
    </div>
  );
}
