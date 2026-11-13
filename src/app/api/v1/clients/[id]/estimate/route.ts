import { guarded } from "../../../guard";
import { startEstimateProject } from "@/lib/crm/startEstimate";

/**
 * "New estimate" on the phone's Customer screen: the same project the web
 * hub's button makes (clients/actions.ts startEstimateForClientAction), and
 * the path to open the estimator on it.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { propertyId?: string };
  return guarded(() => startEstimateProject(id, { propertyId: body.propertyId }));
}

export const dynamic = "force-dynamic";
