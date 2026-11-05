import { db, isMissingTable, MigrationPendingError } from "./db";
import { resolveCrewToken } from "./crewView";
import { cleanSections, cleanValues, type ChecklistSection, type ChecklistValues } from "./checklistTypes";

/**
 * Checklist templates, attached checklists and submissions — database side
 * (migration 0056). Rules and shapes are in checklistTypes.ts, shared with
 * the builder and the crew form.
 */

export type ChecklistTemplate = {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  description: string | null;
  sections: ChecklistSection[];
  archived_at: string | null;
};

export type JobChecklist = {
  id: string;
  job_id: string;
  visit_id: string | null;
  template_id: string | null;
  name: string;
  sections: ChecklistSection[];
  position: number;
};

export type ChecklistSubmission = {
  id: string;
  job_checklist_id: string;
  visit_id: string | null;
  team_member_id: string | null;
  submitted_by: string | null;
  values: ChecklistValues;
  client_submission_id: string;
  submitted_at: string;
};

function requireDb() {
  const client = db();
  if (!client) throw new Error("Database is not configured");
  return client;
}

function fail(error: { message: string }, table: string, what: string): never {
  if (isMissingTable(error)) throw new MigrationPendingError(table, error.message);
  throw new Error(`Could not ${what}: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export async function listTemplates(options: { includeArchived?: boolean } = {}): Promise<ChecklistTemplate[]> {
  const client = requireDb();
  let query = client.from("checklist_templates").select("*").order("name");
  if (!options.includeArchived) query = query.is("archived_at", null);
  const { data, error } = await query;
  if (error) fail(error, "checklist_templates", "load the checklist templates");
  return (data ?? []) as ChecklistTemplate[];
}

export async function getTemplate(id: string): Promise<ChecklistTemplate | null> {
  const client = requireDb();
  const { data, error } = await client.from("checklist_templates").select("*").eq("id", id).maybeSingle();
  if (error) fail(error, "checklist_templates", "load the template");
  return (data as ChecklistTemplate | null) ?? null;
}

/** Create (no id) or replace a template. Returns its id, or the problems. */
export async function saveTemplate(input: {
  id?: string | null;
  name: string;
  description?: string | null;
  sections: unknown;
}): Promise<{ id: string } | { errors: string[] }> {
  const name = input.name.trim().slice(0, 120);
  const { sections, errors } = cleanSections(input.sections);
  if (!name) errors.unshift("Give the checklist a name.");
  if (errors.length) return { errors };

  const client = requireDb();
  const row = { name, description: input.description?.trim() || null, sections };
  if (input.id) {
    const { error } = await client.from("checklist_templates").update(row).eq("id", input.id);
    if (error) fail(error, "checklist_templates", "save the template");
    return { id: input.id };
  }
  const { data, error } = await client.from("checklist_templates").insert(row).select("id").single();
  if (error) fail(error, "checklist_templates", "save the template");
  return { id: data.id as string };
}

export async function setTemplateArchived(id: string, archived: boolean): Promise<void> {
  const client = requireDb();
  const { error } = await client
    .from("checklist_templates")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) fail(error, "checklist_templates", "archive the template");
}

// ---------------------------------------------------------------------------
// Attached to a job
// ---------------------------------------------------------------------------

/** A job's checklists, or [] before the migration runs. */
export async function listJobChecklists(jobId: string): Promise<JobChecklist[]> {
  const client = db();
  if (!client) return [];
  const { data, error } = await client
    .from("job_checklists")
    .select("id, job_id, visit_id, template_id, name, sections, position")
    .eq("job_id", jobId)
    .order("position")
    .order("created_at");
  if (error) return [];
  return (data ?? []) as JobChecklist[];
}

/** Copy a template onto a job — the whole job, or one visit of it. */
export async function attachTemplate(jobId: string, templateId: string, visitId: string | null): Promise<void> {
  const client = requireDb();
  const template = await getTemplate(templateId);
  if (!template) throw new Error("That checklist no longer exists.");
  if (visitId) {
    const visit = await client.from("visits").select("id").eq("id", visitId).eq("job_id", jobId).maybeSingle();
    if (!visit.data) throw new Error("That visit is not on this job.");
  }
  const existing = await listJobChecklists(jobId);
  const { error } = await client.from("job_checklists").insert({
    job_id: jobId,
    visit_id: visitId,
    template_id: template.id,
    name: template.name,
    sections: template.sections,
    position: existing.length,
  });
  if (error) fail(error, "job_checklists", "attach the checklist");
}

export async function detachChecklist(jobId: string, jobChecklistId: string): Promise<void> {
  const client = requireDb();
  const { error } = await client.from("job_checklists").delete().eq("id", jobChecklistId).eq("job_id", jobId);
  if (error) fail(error, "job_checklists", "remove the checklist");
}

/** Every submission for these checklists, newest first. */
export async function listSubmissions(jobChecklistIds: string[]): Promise<ChecklistSubmission[]> {
  if (jobChecklistIds.length === 0) return [];
  const client = db();
  if (!client) return [];
  const { data, error } = await client
    .from("checklist_submissions")
    .select("*")
    .in("job_checklist_id", jobChecklistIds)
    .order("submitted_at", { ascending: false });
  if (error) return [];
  return (data ?? []) as ChecklistSubmission[];
}

// ---------------------------------------------------------------------------
// Crew side — token-guarded, like every other crew write
// ---------------------------------------------------------------------------

export type CrewChecklist = Pick<JobChecklist, "id" | "visit_id" | "name" | "sections"> & {
  /** The latest submission for this checklist (on this visit, for a
      visit-only one), so the form opens filled-in rather than blank. */
  latest: Pick<ChecklistSubmission, "values" | "submitted_at" | "submitted_by"> | null;
};

/** The checklists the crew sees for one visit: the whole-job ones plus that
    visit's own. */
export async function crewChecklists(token: string, visitId: string | null): Promise<CrewChecklist[]> {
  const jobId = await resolveCrewToken(token);
  if (!jobId) return [];
  const all = await listJobChecklists(jobId);
  const shown = all.filter((c) => c.visit_id === null || c.visit_id === visitId);
  const subs = await listSubmissions(shown.map((c) => c.id));
  return shown.map((c) => {
    const latest = subs.find((s) => s.job_checklist_id === c.id && (c.visit_id !== null || !visitId || s.visit_id === visitId));
    return {
      id: c.id,
      visit_id: c.visit_id,
      name: c.name,
      sections: c.sections,
      latest: latest ? { values: latest.values, submitted_at: latest.submitted_at, submitted_by: latest.submitted_by } : null,
    };
  });
}

export type SubmitResult = { ok: true } | { ok: false; errors: string[]; retry: boolean };

/**
 * Save a crew's filled form. Idempotent on `clientSubmissionId`: a phone
 * retrying something that already arrived gets ok, not a duplicate.
 */
export async function submitCrewChecklist(input: {
  token: string;
  jobChecklistId: string;
  visitId: string | null;
  memberId: string | null;
  submittedBy: string | null;
  values: Record<string, unknown>;
  clientSubmissionId: string;
  submittedAt?: string;
}): Promise<SubmitResult> {
  const client = db();
  if (!client) return { ok: false, errors: ["The office system is unavailable."], retry: true };
  if (!/^[\w-]{8,64}$/.test(input.clientSubmissionId)) return { ok: false, errors: ["Bad request."], retry: false };

  const jobId = await resolveCrewToken(input.token);
  if (!jobId) return { ok: false, errors: ["This link has expired."], retry: false };

  const { data: checklist } = await client
    .from("job_checklists")
    .select("id, visit_id, sections")
    .eq("id", input.jobChecklistId)
    .eq("job_id", jobId)
    .maybeSingle();
  if (!checklist) return { ok: false, errors: ["That checklist is no longer on this job."], retry: false };

  const { values, errors } = cleanValues((checklist as { sections: ChecklistSection[] }).sections, input.values);
  if (errors.length) return { ok: false, errors, retry: false };

  let visitId = (checklist as { visit_id: string | null }).visit_id ?? input.visitId;
  if (visitId) {
    const visit = await client.from("visits").select("id").eq("id", visitId).eq("job_id", jobId).maybeSingle();
    if (!visit.data) visitId = null;
  }

  let memberId = input.memberId;
  if (memberId) {
    const member = await client.from("team_members").select("id").eq("id", memberId).eq("active", true).maybeSingle();
    if (!member.data) memberId = null;
  }

  const submittedAt = input.submittedAt && !Number.isNaN(Date.parse(input.submittedAt)) ? input.submittedAt : new Date().toISOString();
  const { error } = await client.from("checklist_submissions").upsert(
    {
      job_checklist_id: input.jobChecklistId,
      visit_id: visitId,
      team_member_id: memberId,
      submitted_by: input.submittedBy?.slice(0, 120) || null,
      values,
      client_submission_id: input.clientSubmissionId,
      submitted_at: submittedAt,
    },
    { onConflict: "client_submission_id", ignoreDuplicates: true },
  );
  if (error) return { ok: false, errors: ["Not saved yet."], retry: true };
  return { ok: true };
}
