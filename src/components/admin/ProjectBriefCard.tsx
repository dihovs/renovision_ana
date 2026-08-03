import type { ProjectBrief } from "@/lib/projectBrief";

/**
 * What the assistant established during the conversation — chat or phone.
 *
 * Lifted out of LeadPipeline when calls grew their own briefs: the call list
 * and the lead card must render the same shape the same way, or the owner
 * learns two layouts for one fact sheet.
 *
 * Facts and open questions are visually separated on purpose: one is what you
 * know, the other is what you still have to ask, and mixing them is how a
 * guess becomes a measurement between the chat and the site visit.
 */
export default function ProjectBriefCard({ brief }: { brief: ProjectBrief }) {
  return (
    <section className="mt-4 rounded-lg border border-black/10 bg-black/[0.015] p-3">
      <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-charcoal/45">The job</p>

      {brief.headline && (
        <p className="font-heading text-sm font-bold text-brand-blue">{brief.headline}</p>
      )}

      {brief.facts.length > 0 && (
        <dl className="mt-2 space-y-1">
          {brief.facts.map((fact) => (
            <div key={`${fact.label}-${fact.value}`} className="flex gap-2 text-sm">
              <dt className="w-28 shrink-0 text-charcoal/50">{fact.label}</dt>
              <dd className="min-w-0 flex-1 text-charcoal/85">{fact.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {brief.customerWords && (
        <blockquote className="mt-3 border-l-[3px] border-black/10 pl-2.5 text-sm italic leading-relaxed text-charcoal/65">
          {brief.customerWords}
        </blockquote>
      )}

      {brief.openQuestions && brief.openQuestions.length > 0 && (
        <div className="mt-3 rounded-md bg-amber-50 p-2.5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-amber-800/80">
            Still to confirm
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm text-amber-900/85">
            {brief.openQuestions.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
