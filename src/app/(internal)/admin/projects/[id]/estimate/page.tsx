import Link from "next/link";
import { notFound } from "next/navigation";
import EstimateBuilder from "@/components/admin/EstimateBuilder";
import AdminNotice from "@/components/admin/AdminNotice";
import { isConfigured, MigrationPendingError } from "@/lib/crm/db";
import { getProject } from "@/lib/crm/projects";
import {
  acceptSuggestionsAction,
  deriveEstimateAction,
  loadEstimateAction,
  saveEstimateLinesAction,
  setFloorFinishAction,
  suggestLinesAction,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function EstimatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!isConfigured) {
    return (
      <AdminNotice title="No database connected yet">
        Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to use the estimator.
      </AdminNotice>
    );
  }

  const project = await getProject(id).catch((err) => {
    if (err instanceof MigrationPendingError) return null;
    throw err;
  });
  if (!project) notFound();

  let initial;
  try {
    initial = await loadEstimateAction(project.id);
  } catch (err) {
    if (err instanceof MigrationPendingError) {
      return (
        <AdminNotice title="One migration to run">
          The estimator needs migration <code>0042_insurance_estimates.sql</code> applied to the
          database. Run it in the Supabase SQL editor, then reload this page.
        </AdminNotice>
      );
    }
    throw err;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 sm:p-6">
      <Link
        href={`/admin/projects/${project.id}`}
        className="inline-flex items-center gap-1 text-sm font-semibold text-charcoal/50 transition-colors hover:text-charcoal"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M15 18l-6-6 6-6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {project.name}
      </Link>

      <div className="flex items-baseline justify-between">
        <h1 className="font-heading text-xl font-bold text-charcoal">Insurance estimate</h1>
        <span className="shrink-0 rounded-full bg-brand-blue/[0.08] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-blue">
          {initial.status}
        </span>
      </div>

      <EstimateBuilder
        projectId={project.id}
        initial={initial}
        deriveAction={deriveEstimateAction.bind(null, project.id)}
        saveAction={saveEstimateLinesAction.bind(null, project.id)}
        suggestAction={suggestLinesAction.bind(null, project.id)}
        acceptAction={acceptSuggestionsAction.bind(null, project.id)}
        finishAction={setFloorFinishAction.bind(null, project.id)}
      />
    </div>
  );
}
