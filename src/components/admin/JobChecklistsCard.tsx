import Link from "next/link";
import { attachChecklistAction, detachChecklistAction } from "@/app/(internal)/admin/checklists/actions";
import { Card, SectionHeader, StatusPill } from "@/components/admin/ui/Hub";
import { listJobChecklists, listSubmissions, listTemplates, type ChecklistTemplate } from "@/lib/crm/checklists";
import { answeredCount, type ChecklistField, type FieldValue } from "@/lib/crm/checklistTypes";
import type { Visit } from "@/lib/crm/opsTypes";

/**
 * The job's checklists (migration 0056): what is attached, to the whole job
 * or one visit, and what the crew sent back. Renders nothing before the
 * migration runs, so the job page is unchanged until then.
 */
export default async function JobChecklistsCard({ jobId, visits }: { jobId: string; visits: Visit[] }) {
  let templates: ChecklistTemplate[];
  try {
    templates = await listTemplates();
  } catch {
    return null;
  }
  const attached = await listJobChecklists(jobId);
  const submissions = await listSubmissions(attached.map((c) => c.id));
  const visitLabel = (id: string | null) => {
    if (!id) return "Whole job";
    const visit = visits.find((v) => v.id === id);
    return visit
      ? `Visit ${new Date(visit.starts_at).toLocaleDateString("en-CA", { month: "short", day: "numeric", timeZone: "America/Toronto" })}`
      : "A removed visit";
  };

  return (
    <Card>
      <SectionHeader title="Checklists" count={attached.length} action={<Link href="/admin/checklists" className="text-[13px] font-bold text-brand-blue">Templates</Link>} />
      {attached.length > 0 && (
        <ul className="divide-y divide-black/[0.05] border-t border-black/[0.05]">
          {attached.map((checklist) => {
            const subs = submissions.filter((s) => s.job_checklist_id === checklist.id);
            const latest = subs[0];
            const count = latest ? answeredCount(checklist.sections, latest.values) : null;
            return (
              <li key={checklist.id} className="px-4 py-3 sm:px-5">
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-charcoal">{checklist.name}</span>
                  <StatusPill tone="grey">{visitLabel(checklist.visit_id)}</StatusPill>
                  {latest ? (
                    <StatusPill tone="green">
                      Filled {count!.answered}/{count!.total}
                    </StatusPill>
                  ) : (
                    <StatusPill tone="amber">Not filled</StatusPill>
                  )}
                  <form action={detachChecklistAction.bind(null, jobId, checklist.id)}>
                    <button type="submit" aria-label="Remove checklist" className="cursor-pointer px-1 text-sm font-bold text-charcoal/30 hover:text-red-600">
                      ×
                    </button>
                  </form>
                </div>
                {latest && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs font-semibold text-brand-blue">
                      {latest.submitted_by ? `${latest.submitted_by} · ` : ""}
                      {new Date(latest.submitted_at).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Toronto" })}
                      {subs.length > 1 ? ` · ${subs.length} submissions` : ""}
                    </summary>
                    <dl className="mt-2 space-y-2">
                      {checklist.sections.map((section) => (
                        <div key={section.id}>
                          {section.title && <dt className="text-xs font-bold uppercase tracking-wide text-charcoal/40">{section.title}</dt>}
                          {section.fields.map((field) => (
                            <dd key={field.id} className="mt-1 flex gap-3 text-sm">
                              <span className="w-1/2 shrink-0 text-charcoal/60">{field.label}</span>
                              <span className="min-w-0 flex-1 text-charcoal">
                                <Answer field={field} value={latest.values[field.id]} />
                              </span>
                            </dd>
                          ))}
                        </div>
                      ))}
                    </dl>
                  </details>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {templates.length === 0 ? (
        <p className="border-t border-black/[0.05] px-4 py-3 text-sm text-charcoal/45 sm:px-5">
          No checklist templates yet. <Link href="/admin/checklists" className="font-semibold text-brand-blue">Build one</Link>.
        </p>
      ) : (
        <form action={attachChecklistAction.bind(null, jobId)} className="flex flex-col gap-2 border-t border-black/[0.05] px-4 py-3 sm:flex-row sm:px-5">
          <select name="templateId" aria-label="Checklist" className="min-w-0 flex-1 rounded-lg border border-black/10 bg-white px-3 py-2 text-sm" defaultValue="">
            <option value="" disabled>
              Attach a checklist…
            </option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <select name="visitId" aria-label="For" className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm" defaultValue="">
            <option value="">Whole job</option>
            {visits.map((v) => (
              <option key={v.id} value={v.id}>
                {visitLabel(v.id)}
                {v.title ? ` · ${v.title}` : ""}
              </option>
            ))}
          </select>
          <button type="submit" className="cursor-pointer rounded-lg bg-brand-blue px-4 py-2 text-sm font-bold text-white">
            Attach
          </button>
        </form>
      )}
    </Card>
  );
}

function Answer({ field, value }: { field: ChecklistField; value: FieldValue | undefined }) {
  if (value === null || value === undefined || value === "") return <span className="text-charcoal/30">—</span>;
  switch (field.type) {
    case "checkbox":
      return value === true ? <span className="font-semibold text-green-700">Yes</span> : <span className="text-charcoal/45">No</span>;
    case "signature":
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={String(value)} alt="Signature" className="h-16 rounded border border-black/10 bg-white" />;
    case "photo":
      return (
        <span className="flex flex-wrap gap-1.5">
          {(Array.isArray(value) ? value : []).map((src, i) => (
            <a key={i} href={src} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`${field.label} ${i + 1}`} className="h-16 w-16 rounded object-cover" />
            </a>
          ))}
        </span>
      );
    case "link":
      return (
        <a href={String(value)} target="_blank" rel="noreferrer" className="break-all text-brand-blue underline">
          {String(value)}
        </a>
      );
    case "number":
      return <span className="tabular-nums">{String(value)}{field.unit ? ` ${field.unit}` : ""}</span>;
    default:
      return <span className="whitespace-pre-wrap">{String(value)}</span>;
  }
}
