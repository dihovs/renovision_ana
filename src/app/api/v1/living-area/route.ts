import { NextResponse } from "next/server";
import { guarded } from "../guard";
import { listRoomScans } from "@/lib/crm/roomScans";
import {
  calculateLivingArea,
  DEFAULT_LIVING_AREA_CONFIG,
  LIVING_AREA_DEFINITION,
  ROOM_TYPES,
  type LivingAreaConfig,
} from "@/lib/crm/livingArea";
import { db } from "@/lib/crm/db";

/**
 * What counts as living area on this property, and why.
 *
 * Returns the totals AND the per-room working, because a living-area figure
 * with no breakdown is one an adjuster has to take on faith — and they will
 * not. The definition travels with it for the same reason.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const projectId = new URL(request.url).searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "projectId is required." }, { status: 400 });
  }

  return guarded(async () => {
    const client = db();
    let config: LivingAreaConfig = DEFAULT_LIVING_AREA_CONFIG;
    if (client) {
      const { data } = await client
        .from("projects")
        .select("living_area_config")
        .eq("id", projectId)
        .maybeSingle();
      const stored = data?.living_area_config as Partial<LivingAreaConfig> | null;
      if (stored) config = { ...DEFAULT_LIVING_AREA_CONFIG, ...stored };
    }

    const scans = await listRoomScans(projectId);
    const totals = calculateLivingArea(
      scans.map((scan) => ({
        id: scan.id,
        name: scan.name,
        floorAreaSqm: Number(scan.floor_area_sqm),
        ceilingHeightM: Number(scan.ceiling_height_m),
        roomType: scan.room_type,
        livingPercent: scan.living_percent === null ? null : Number(scan.living_percent),
      })),
      config,
    );

    return { config, totals, definition: LIVING_AREA_DEFINITION, roomTypes: ROOM_TYPES };
  });
}

export async function PATCH(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const projectId = typeof body.projectId === "string" ? body.projectId : "";
  if (!projectId) {
    return NextResponse.json({ error: "projectId is required." }, { status: 400 });
  }

  return guarded(async () => {
    const client = db();
    if (!client) throw new Error("Database is not configured");

    const config: LivingAreaConfig = {
      includeInteriorWalls: body.includeInteriorWalls === true,
      minHeightM: Number.isFinite(Number(body.minHeightM))
        ? Number(body.minHeightM)
        : DEFAULT_LIVING_AREA_CONFIG.minHeightM,
    };

    const { error } = await client
      .from("projects")
      .update({ living_area_config: config })
      .eq("id", projectId);
    if (error) throw new Error(`Could not save the rules: ${error.message}`);
    return { ok: true, config };
  });
}
