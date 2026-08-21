"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isSignedIn } from "@/lib/adminAuth";
import {
  attachJob,
  createProject,
  deleteProjectFile,
  detachJob,
  getProject,
  PROJECT_STATUSES,
  updateProjectCustom,
  updateProjectStatus,
  type ProjectStatus,
} from "@/lib/crm/projects";
import { emailPhotos, type SendPhotosResult } from "@/lib/crm/sendDocument";

export type ProjectFormState = { error?: string };

/**
 * The UI already sits behind the layout's auth check, but a server action is
 * a public endpoint — hiding a form is not access control.
 */
async function requireSession(): Promise<void> {
  if (!(await isSignedIn())) throw new Error("Not authorised");
}

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export async function createProjectAction(
  _prev: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  await requireSession();

  let id: string;
  try {
    const name = str(formData, "name");
    if (!name) return { error: "Give the project a name." };
    id = await createProject({
      name,
      clientId: str(formData, "clientId") || null,
      description: str(formData, "description") || null,
      startedOn: str(formData, "startedOn") || null,
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not create the project." };
  }

  revalidatePath("/admin/projects");
  // Outside the try: redirect signals by throwing, and catching it here would
  // turn a successful save into an error message.
  redirect(`/admin/projects/${id}`);
}

export async function setProjectStatusAction(id: string, status: string): Promise<void> {
  await requireSession();
  // The status came over the wire from a browser; the check constraint would
  // also refuse it, but failing early gives a readable message.
  if (!PROJECT_STATUSES.includes(status as ProjectStatus)) {
    throw new Error("Unknown status");
  }
  await updateProjectStatus(id, status as ProjectStatus);
  revalidatePath("/admin/projects");
  revalidatePath(`/admin/projects/${id}`);
}

export async function attachJobAction(projectId: string, jobId: string): Promise<void> {
  await requireSession();
  if (!jobId) throw new Error("Pick a job to attach.");
  await attachJob(projectId, jobId);
  revalidatePath(`/admin/projects/${projectId}`);
}

export async function detachJobAction(projectId: string, jobId: string): Promise<void> {
  await requireSession();
  await detachJob(projectId, jobId);
  revalidatePath(`/admin/projects/${projectId}`);
}

export async function deleteProjectFileAction(
  projectId: string,
  fileId: string,
): Promise<void> {
  await requireSession();
  await deleteProjectFile(fileId);
  revalidatePath(`/admin/projects/${projectId}`);
}

/**
 * Save the project's claim details.
 *
 * Every `custom__`-prefixed field on the form, including the ones the
 * conditional logic is currently hiding — those post their stored value, so
 * switching Type of Loss away and back does not destroy an answer.
 */
export async function saveProjectCustomAction(
  projectId: string,
  formData: FormData,
): Promise<void> {
  await requireSession();
  const custom: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("custom__") && typeof value === "string") {
      custom[key.slice("custom__".length)] = value;
    }
  }
  await updateProjectCustom(projectId, custom);
  revalidatePath(`/admin/projects/${projectId}`);
}

/**
 * Email a hand-picked set of the project's photos to a customer.
 *
 * Unlike `sendQuoteAction`, the email here is not a best-effort side effect —
 * it is the entire point of pressing the button — so a transport failure
 * propagates instead of being swallowed, and the picker screen shows it.
 */
export async function emailPhotosAction(
  projectId: string,
  payload: {
    to: string[];
    photos: Array<{ path: string; filename: string }>;
    note: string;
    language: "fr" | "en";
  },
): Promise<SendPhotosResult> {
  await requireSession();
  const project = await getProject(projectId);
  if (!project) throw new Error("This project no longer exists.");

  return emailPhotos({
    to: payload.to,
    projectName: project.name,
    photos: payload.photos,
    note: payload.note,
    language: payload.language,
  });
}
