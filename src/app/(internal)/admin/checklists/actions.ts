"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isSignedIn } from "@/lib/adminAuth";
import { attachTemplate, detachChecklist, saveTemplate, setTemplateArchived } from "@/lib/crm/checklists";

async function requireSession() {
  if (!(await isSignedIn())) throw new Error("Not authorised");
}

export type BuilderState = { errors?: string[]; saved?: boolean };

/** Save a template from the builder. The sections arrive as JSON. */
export async function saveTemplateAction(
  id: string | null,
  payload: { name: string; description: string; sections: unknown },
): Promise<BuilderState> {
  await requireSession();
  const result = await saveTemplate({ id, ...payload });
  if ("errors" in result) return { errors: result.errors };
  revalidatePath("/admin/checklists");
  if (!id) redirect(`/admin/checklists/${result.id}`);
  revalidatePath(`/admin/checklists/${id}`);
  return { saved: true };
}

export async function archiveTemplateAction(id: string, archived: boolean): Promise<void> {
  await requireSession();
  await setTemplateArchived(id, archived);
  revalidatePath("/admin/checklists");
  redirect("/admin/checklists");
}

/** From the job page: put a template on the job, or on one visit of it. */
export async function attachChecklistAction(jobId: string, formData: FormData): Promise<void> {
  await requireSession();
  const templateId = String(formData.get("templateId") ?? "");
  const visitId = String(formData.get("visitId") ?? "") || null;
  if (!templateId) return;
  await attachTemplate(jobId, templateId, visitId);
  revalidatePath(`/admin/jobs/${jobId}`);
}

export async function detachChecklistAction(jobId: string, jobChecklistId: string): Promise<void> {
  await requireSession();
  await detachChecklist(jobId, jobChecklistId);
  revalidatePath(`/admin/jobs/${jobId}`);
}
