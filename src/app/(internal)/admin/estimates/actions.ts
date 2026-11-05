"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { startEstimateForClientAction } from "../clients/actions";
import { isSignedIn } from "@/lib/adminAuth";
import { createProject } from "@/lib/crm/projects";

/**
 * "New estimate" on the Estimates page.
 *
 * With a client it is exactly the client hub's button — same project, same
 * name, same address — so the two doors cannot make different things. With
 * no client it makes an unattached project (a walk-through before anybody
 * has given a name), which can be given a client later from the project.
 */
export async function newEstimateAction(formData: FormData): Promise<void> {
  if (!(await isSignedIn())) throw new Error("Not authorised");

  const clientId = String(formData.get("clientId") ?? "").trim();
  if (clientId) return startEstimateForClientAction(clientId, formData);

  const name = String(formData.get("name") ?? "").trim() || "New estimate";
  const projectId = await createProject({ name });
  revalidatePath("/admin/estimates");
  revalidatePath("/admin/projects");
  redirect(`/admin/projects/${projectId}/estimate`);
}
