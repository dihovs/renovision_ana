import { db, isMissingTable, MigrationPendingError } from "./db";
import type { EstimateLine, TradeSection, TrailerSettings } from "../estimator/insurance/types";
import { TRADE_SECTIONS } from "../estimator/insurance/types";
import { allocateLines, estimateTotals } from "../estimator/insurance/trailer";
import { clientDisplayName } from "./types";

/**
 * Insurance estimates — database side.
 *
 * The document itself is a settings row plus a bag of lines; every dollar
 * figure is computed from the lines at read time by the estimator's own
 * arithmetic (`estimator/insurance/trailer.ts`) and never persisted, so the
 * document cannot disagree with its lines. Rates on a line ARE persisted —
 * copied cents, frozen at write time the way quote lines copy the price
 * book, so repricing the book changes future estimates and not this one.
 *
 * Quantities travel as two-decimal numbers in the app and are stored ×100
 * as integers (`quantity_hundredths`), the same discipline as money cents:
 * the arithmetic in trailer.ts depends on quantities being exactly
 * two-decimal, and a float column would quietly break it.
 */

export type InsuranceEstimate = {
  id: string;
  created_at: string;
  updated_at: string;
  project_id: string;
  status: "draft" | "final";
  title: string;
  generals_bp: number;
  profit_bp: number;
  profit_basis: "items_plus_generals" | "items";
  notes: string | null;
};

export type InsuranceEstimateWithLines = InsuranceEstimate & { lines: EstimateLine[] };

type LineRow = {
  id: string;
  estimate_id: string;
  position: number;
  key: string;
  origin: "derived" | "manual";
  provenance: "rule" | "ai" | "operator";
  room_scan_id: string | null;
  room_name: string;
  trade_section: string;
  activity: EstimateLine["activity"];
  item_code: string | null;
  removal_item_code: string | null;
  name: string;
  unit: string;
  quantity_hundredths: number;
  remove_rate_cents: number | null;
  replace_rate_cents: number | null;
  calc: string;
  note: string | null;
  issues: string;
  taxable: boolean;
  removed: boolean;
};

function requireDb() {
  const client = db();
  if (!client) throw new Error("Database is not configured");
  return client;
}

function fail(error: { message: string }, what: string): never {
  if (isMissingTable(error)) {
    throw new MigrationPendingError("insurance_estimates", error.message);
  }
  throw new Error(`Could not ${what}: ${error.message}`);
}

function toTradeSection(value: string): TradeSection {
  return (TRADE_SECTIONS as readonly string[]).includes(value)
    ? (value as TradeSection)
    : "misc";
}

function toEstimateLine(row: LineRow): EstimateLine {
  return {
    key: row.key,
    origin: row.origin,
    provenance: row.provenance,
    roomScanId: row.room_scan_id,
    roomName: row.room_name,
    tradeSection: toTradeSection(row.trade_section),
    activity: row.activity,
    itemCode: row.item_code,
    removalItemCode: row.removal_item_code,
    name: row.name,
    unit: row.unit,
    quantity: row.quantity_hundredths / 100,
    removeRateCents: row.remove_rate_cents,
    replaceRateCents: row.replace_rate_cents,
    calc: row.calc,
    note: row.note,
    issues: row.issues
      ? (row.issues.split(",").filter(Boolean) as EstimateLine["issues"])
      : [],
    taxable: row.taxable,
    removed: row.removed,
  };
}

function toLineRow(estimateId: string, line: EstimateLine, position: number) {
  return {
    estimate_id: estimateId,
    position,
    key: line.key.slice(0, 300),
    origin: line.origin,
    provenance: line.provenance,
    room_scan_id: line.roomScanId,
    room_name: line.roomName.slice(0, 200),
    trade_section: line.tradeSection,
    activity: line.activity,
    item_code: line.itemCode,
    removal_item_code: line.removalItemCode,
    name: line.name.slice(0, 300),
    unit: line.unit.slice(0, 40),
    quantity_hundredths: Math.round(line.quantity * 100),
    remove_rate_cents: line.removeRateCents,
    replace_rate_cents: line.replaceRateCents,
    calc: line.calc.slice(0, 500),
    note: line.note?.slice(0, 1000) ?? null,
    issues: line.issues.join(","),
    taxable: line.taxable,
    removed: line.removed,
  };
}

export function trailerSettings(estimate: InsuranceEstimate): TrailerSettings {
  return {
    generalsPct: estimate.generals_bp / 10_000,
    profitPct: estimate.profit_bp / 10_000,
    profitBasis: estimate.profit_basis,
    gstPct: 0.05,
    qstPct: 0.09975,
  };
}

/** The project's working draft, created on first touch. The partial unique
    index guarantees at most one draft; the upsert-shaped select handles the
    race of two first touches. */
export async function getOrCreateDraft(projectId: string): Promise<InsuranceEstimateWithLines> {
  const client = requireDb();
  const existing = await client
    .from("insurance_estimates")
    .select("*, insurance_estimate_lines(*)")
    .eq("project_id", projectId)
    .eq("status", "draft")
    .maybeSingle();
  if (existing.error) fail(existing.error, "load the estimate");
  if (existing.data) return withSortedLines(existing.data);

  const inserted = await client
    .from("insurance_estimates")
    .insert({ project_id: projectId })
    .select("*, insurance_estimate_lines(*)")
    .single();
  if (inserted.error) {
    // Two first touches raced; the loser reads the winner's row.
    const retry = await client
      .from("insurance_estimates")
      .select("*, insurance_estimate_lines(*)")
      .eq("project_id", projectId)
      .eq("status", "draft")
      .maybeSingle();
    if (retry.error || !retry.data) fail(inserted.error, "create the estimate");
    return withSortedLines(retry.data);
  }
  return withSortedLines(inserted.data);
}

type EstimateJoinRow = InsuranceEstimate & { insurance_estimate_lines: LineRow[] };

function withSortedLines(row: unknown): InsuranceEstimateWithLines {
  const joined = row as EstimateJoinRow;
  const lines = [...(joined.insurance_estimate_lines ?? [])]
    .sort((a, b) => a.position - b.position)
    .map(toEstimateLine);
  const { insurance_estimate_lines: _lines, ...estimate } = joined;
  return { ...estimate, lines };
}

/**
 * Persist the full line set — the whole-document write the quote editor
 * already uses (`replaceLines`), for the same reason: the merge semantics
 * run in memory and the saved rows are their result, so a partial write
 * could strand half a merge. Capped generously; a real estimate in the
 * reference claims is under a hundred lines.
 */
export async function saveLines(estimateId: string, lines: EstimateLine[]): Promise<void> {
  const client = requireDb();
  const capped = lines.slice(0, 400);

  const del = await client
    .from("insurance_estimate_lines")
    .delete()
    .eq("estimate_id", estimateId);
  if (del.error) fail(del.error, "save the estimate lines");

  if (capped.length === 0) return;
  const ins = await client
    .from("insurance_estimate_lines")
    .insert(capped.map((line, index) => toLineRow(estimateId, line, index)));
  if (ins.error) fail(ins.error, "save the estimate lines");
}

export async function updateEstimateSettings(
  estimateId: string,
  patch: Partial<Pick<InsuranceEstimate, "title" | "notes" | "generals_bp" | "profit_bp" | "profit_basis">>,
): Promise<void> {
  const client = requireDb();
  const { error } = await client
    .from("insurance_estimates")
    .update(patch)
    .eq("id", estimateId);
  if (error) fail(error, "update the estimate");
}

/** Set a room's floor finish — recorded on the scan, where the room lives,
    because it is a fact about the room and every future estimate needs it. */
export async function setRoomFloorFinish(
  roomScanId: string,
  finish: "laminate" | "lvp" | "engineered" | "hardwood" | "carpet" | "tile" | null,
): Promise<void> {
  const client = requireDb();
  const { error } = await client
    .from("room_scans")
    .update({ floor_finish: finish })
    .eq("id", roomScanId);
  if (error) fail(error, "record the floor finish");
}

// ---------------------------------------------------------------------------
// Lists — the Estimates page and the client hub
// ---------------------------------------------------------------------------

export type InsuranceEstimateListItem = InsuranceEstimate & {
  project_name: string;
  project_status: string;
  client_id: string | null;
  client_name: string | null;
  address: string | null;
  line_count: number;
  /** Computed by the estimator's own trailer — never stored, never a second
      copy of the arithmetic. */
  total_cents: number;
};

type ListJoinRow = EstimateJoinRow & {
  projects: {
    name: string;
    status: string;
    client_id: string | null;
    address_line1: string | null;
    address_city: string | null;
    clients: Parameters<typeof clientDisplayName>[0] | null;
  } | null;
};

/**
 * Every insurance estimate, newest edit first, optionally for one client or
 * one project. Each total is worked out from its lines at read time, the same
 * way the estimate page does it, so a list figure cannot disagree with the
 * document.
 */
export async function listInsuranceEstimates(
  options: { clientId?: string; projectId?: string; status?: "draft" | "final"; limit?: number } = {},
): Promise<InsuranceEstimateListItem[]> {
  const client = requireDb();
  const { clientId, projectId, status, limit = 200 } = options;

  // `!inner` so a client filter on the joined project actually filters the
  // estimates rather than nulling the embed.
  const projectEmbed = clientId
    ? "projects!inner(name, status, client_id, address_line1, address_city, clients(first_name, last_name, company_name))"
    : "projects(name, status, client_id, address_line1, address_city, clients(first_name, last_name, company_name))";

  let query = client
    .from("insurance_estimates")
    .select(`*, insurance_estimate_lines(*), ${projectEmbed}`)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (clientId) query = query.eq("projects.client_id", clientId);
  if (projectId) query = query.eq("project_id", projectId);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) fail(error, "load the estimates");

  return ((data ?? []) as unknown as ListJoinRow[]).map((row) => {
    const { projects: project, ...rest } = row;
    const estimate = withSortedLines(rest);
    const totals = estimateTotals(allocateLines(estimate.lines, trailerSettings(estimate)));
    const { lines, ...head } = estimate;
    const address = [project?.address_line1, project?.address_city].filter(Boolean).join(", ");
    return {
      ...head,
      project_name: project?.name ?? "Project",
      project_status: project?.status ?? "active",
      client_id: project?.client_id ?? null,
      client_name: project?.clients ? clientDisplayName(project.clients) : null,
      address: address || null,
      line_count: lines.filter((line) => !line.removed).length,
      total_cents: totals.totalCents,
    };
  });
}
