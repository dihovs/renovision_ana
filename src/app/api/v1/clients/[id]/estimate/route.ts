import { guarded } from "../../../guard";
import { getClient } from "@/lib/crm/clients";
import { createProject, updateProjectDetails } from "@/lib/crm/projects";
import { clientDisplayName } from "@/lib/crm/types";

/**
 * "New estimate" on the phone's Customer screen: the same project the web
 * hub's button makes (clients/actions.ts startEstimateForClientAction), and
 * the path to open the estimator on it.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { propertyId?: string };

  return guarded(async () => {
    const client = await getClient(id);
    if (!client) throw new Error("No such customer.");
    const property =
      client.properties.find((p) => p.id === body.propertyId) ??
      (client.properties.length === 1 ? client.properties[0] : undefined);
    const street = property?.street1?.trim() || "";
    const projectId = await createProject({
      name: street ? `${street} — estimate` : `${clientDisplayName(client)} — estimate`,
      clientId: id,
    });
    if (property) {
      await updateProjectDetails(projectId, {
        addressLine1: [property.street1, property.street2].filter(Boolean).join(", ") || null,
        addressCity: property.city,
        addressPostal: property.postal_code,
      });
    }
    return { projectId, path: `/admin/projects/${projectId}/estimate` };
  });
}

export const dynamic = "force-dynamic";
