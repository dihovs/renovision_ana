import { getClient } from "./clients";
import { createProject, updateProjectDetails } from "./projects";
import { clientDisplayName } from "./types";

/**
 * The project a new estimate lives on, for a customer — named from the
 * property's street, its address copied over. Shared by the phone's Customer
 * screen (`/api/v1/clients/[id]/estimate`) and the lead sheet
 * (`/api/v1/leads/[id]/estimate`); the web hub's button
 * (clients/actions.ts startEstimateForClientAction) does the same with a
 * name of its own.
 *
 * `description` is the customer's own words (a lead's scope summary): it goes
 * on the project so the estimator's AI box can start from it.
 */
export async function startEstimateProject(
  clientId: string,
  opts: { propertyId?: string; description?: string | null } = {},
): Promise<{ projectId: string; path: string }> {
  const client = await getClient(clientId);
  if (!client) throw new Error("No such customer.");
  const property =
    client.properties.find((p) => p.id === opts.propertyId) ??
    (client.properties.length === 1 ? client.properties[0] : undefined);
  const street = property?.street1?.trim() || "";
  const projectId = await createProject({
    name: street ? `${street} — estimate` : `${clientDisplayName(client)} — estimate`,
    clientId,
    description: opts.description ?? null,
  });
  if (property) {
    await updateProjectDetails(projectId, {
      addressLine1: [property.street1, property.street2].filter(Boolean).join(", ") || null,
      addressCity: property.city,
      addressPostal: property.postal_code,
    });
  }
  return { projectId, path: `/admin/projects/${projectId}/estimate` };
}
