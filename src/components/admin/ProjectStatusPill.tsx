import { PROJECT_STATUS_LABEL, type ProjectStatus } from "@/lib/crm/projects";

/**
 * The status pill used on the project list and detail screens.
 *
 * Shared so the two screens can't drift: a status that reads amber on the
 * list and grey on the detail page would look like a change that never
 * happened. Colours follow the jobs screen's vocabulary — blue for underway,
 * amber for waiting, green for finished, grey for out of the way.
 */

const STATUS_STYLE: Record<ProjectStatus, string> = {
  active: "bg-brand-blue/[0.08] text-brand-blue",
  on_hold: "bg-amber-100 text-amber-800",
  done: "bg-green-100 text-green-800",
  archived: "bg-black/[0.05] text-charcoal/50",
};

export default function ProjectStatusPill({ status }: { status: ProjectStatus }) {
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${STATUS_STYLE[status]}`}
    >
      {PROJECT_STATUS_LABEL[status]}
    </span>
  );
}
