import type { AffectedArea, AreaPoint, DamageType } from "@/lib/crm/areaShapes";

/**
 * Affected areas, from the phone.
 *
 * The browser half of `/api/v1/areas` — the DB module it talks to is
 * server-only, so the editor reaches it over HTTP like any other client.
 */

async function fail(response: Response, fallback: string): Promise<never> {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  throw new Error(body?.error ?? fallback);
}

export async function listRoomAreas(roomScanId: string): Promise<AffectedArea[]> {
  const response = await fetch(`/api/v1/areas?roomScanId=${encodeURIComponent(roomScanId)}`);
  if (!response.ok) await fail(response, "Could not load the affected areas.");
  return ((await response.json()) as { areas: AffectedArea[] }).areas;
}

export async function listProjectAreas(projectId: string): Promise<AffectedArea[]> {
  const response = await fetch(`/api/v1/areas?projectId=${encodeURIComponent(projectId)}`);
  if (!response.ok) await fail(response, "Could not load the affected areas.");
  return ((await response.json()) as { areas: AffectedArea[] }).areas;
}

export async function createArea(input: {
  roomScanId: string;
  name: string;
  damageType: DamageType;
  polygon: AreaPoint[];
  surface?: "floor" | "wall";
  wallIndex?: number | null;
}): Promise<string> {
  const response = await fetch("/api/v1/areas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) await fail(response, "Could not save the affected area.");
  return ((await response.json()) as { id: string }).id;
}

export async function updateArea(
  id: string,
  patch: { name?: string; damageType?: DamageType; polygon?: AreaPoint[] },
): Promise<void> {
  const response = await fetch(`/api/v1/areas/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!response.ok) await fail(response, "Could not save the change.");
}

export async function deleteArea(id: string): Promise<void> {
  const response = await fetch(`/api/v1/areas/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!response.ok) await fail(response, "Could not remove the affected area.");
}
