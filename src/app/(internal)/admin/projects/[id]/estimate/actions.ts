"use server";

import { randomUUID } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { revalidatePath } from "next/cache";
import { isSignedIn } from "@/lib/adminAuth";
import {
  getOrCreateDraft,
  saveLines,
  setRoomFloorFinish,
  updateEstimateSettings,
  type InsuranceEstimateWithLines,
} from "@/lib/crm/insuranceEstimates";
import { buildEstimateContext } from "@/lib/estimator/insurance/context";
import { applyMinimumCharges, deriveLines, mergeLines } from "@/lib/estimator/insurance/derive";
import {
  PROPOSE_TOOL,
  acceptedLine,
  buildSuggestionContext,
  validateProposals,
  type SuggestedLine,
} from "@/lib/estimator/insurance/suggest";
import { TRADE_SECTIONS, type EstimateLine } from "@/lib/estimator/insurance/types";
import { buildCatalogSummary } from "@/lib/estimator/catalog";

async function requireSession(): Promise<void> {
  if (!(await isSignedIn())) throw new Error("Not authorised");
}

/** Per-trade minimum labour charges — the owner's numbers, none supplied
    yet. The machinery runs with an empty table until he provides them. */
const MINIMUM_CHARGES: Record<string, number> = {};

const FINISHES = ["laminate", "lvp", "engineered", "hardwood", "carpet", "tile"] as const;
type Finish = (typeof FINISHES)[number];

// ---------------------------------------------------------------------------
// Sanitising — lines arriving from the browser are re-validated field by
// field, the same discipline as the quote actions. Rates ARE accepted from
// the client: the estimate is the operator's document and hand-priced lines
// are a feature, not a hole — but every value is coerced and capped.

function cleanString(value: unknown, max: number): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}

function cleanNullableString(value: unknown, max: number): string | null {
  return typeof value === "string" && value.length > 0 ? value.slice(0, max) : null;
}

function cleanCents(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(100_000_000, Math.round(value)));
}

function sanitizeLine(raw: unknown): EstimateLine | null {
  if (typeof raw !== "object" || raw === null) return null;
  const l = raw as Record<string, unknown>;
  const quantity = typeof l.quantity === "number" && Number.isFinite(l.quantity) ? l.quantity : 0;
  const key = cleanString(l.key, 300);
  if (!key) return null;
  const issues = Array.isArray(l.issues)
    ? (l.issues.filter((i) => i === "no_item" || i === "unknown_finish") as EstimateLine["issues"])
    : [];
  return {
    key,
    origin: l.origin === "manual" ? "manual" : "derived",
    provenance: l.provenance === "ai" ? "ai" : l.provenance === "operator" ? "operator" : "rule",
    roomScanId: cleanNullableString(l.roomScanId, 100),
    roomName: cleanString(l.roomName, 200),
    tradeSection: (TRADE_SECTIONS as readonly string[]).includes(l.tradeSection as string)
      ? (l.tradeSection as EstimateLine["tradeSection"])
      : "misc",
    activity: ["install", "remove", "replace", "detachReset", "memo"].includes(
      l.activity as string,
    )
      ? (l.activity as EstimateLine["activity"])
      : "install",
    itemCode: cleanNullableString(l.itemCode, 60),
    removalItemCode: cleanNullableString(l.removalItemCode, 60),
    name: cleanString(l.name, 300) || "Line",
    unit: cleanString(l.unit, 40) || "each",
    quantity: Math.max(0, Math.min(1_000_000, Math.round(quantity * 100) / 100)),
    removeRateCents: cleanCents(l.removeRateCents),
    replaceRateCents: cleanCents(l.replaceRateCents),
    calc: cleanString(l.calc, 500),
    note: cleanNullableString(l.note, 1000),
    issues,
    taxable: l.taxable !== false,
    removed: l.removed === true,
  };
}

// ---------------------------------------------------------------------------

export type EstimateSnapshot = Pick<
  InsuranceEstimateWithLines,
  "id" | "status" | "title" | "generals_bp" | "profit_bp" | "profit_basis"
> & { lines: EstimateLine[] };

function snapshot(estimate: InsuranceEstimateWithLines): EstimateSnapshot {
  return {
    id: estimate.id,
    status: estimate.status,
    title: estimate.title,
    generals_bp: estimate.generals_bp,
    profit_bp: estimate.profit_bp,
    profit_basis: estimate.profit_basis,
    lines: estimate.lines,
  };
}

export async function loadEstimateAction(projectId: string): Promise<EstimateSnapshot> {
  await requireSession();
  return snapshot(await getOrCreateDraft(projectId));
}

/** The autofill door: derive from the measurements, merge against what the
    operator has, top up minimums, persist, return the result. Manual lines
    — including accepted AI suggestions and removed-line tombstones —
    survive by contract. */
export async function deriveEstimateAction(projectId: string): Promise<EstimateSnapshot> {
  await requireSession();
  const estimate = await getOrCreateDraft(projectId);
  const ctx = await buildEstimateContext(projectId);
  const merged = applyMinimumCharges(
    mergeLines(estimate.lines, deriveLines(ctx)),
    MINIMUM_CHARGES,
  );
  await saveLines(estimate.id, merged);
  revalidatePath(`/admin/projects/${projectId}`);
  revalidatePath(`/admin/projects/${projectId}/estimate`);
  return { ...snapshot(estimate), lines: merged };
}

/** The manual door: the whole line set, saved as edited. */
export async function saveEstimateLinesAction(
  projectId: string,
  estimateId: string,
  rawLines: unknown[],
): Promise<void> {
  await requireSession();
  const lines = rawLines.slice(0, 400).map(sanitizeLine).filter((l): l is EstimateLine => l !== null);
  await saveLines(estimateId, lines);
  revalidatePath(`/admin/projects/${projectId}/estimate`);
}

export async function updateEstimateTitleAction(
  projectId: string,
  estimateId: string,
  title: string,
): Promise<void> {
  await requireSession();
  await updateEstimateSettings(estimateId, { title: title.slice(0, 200) || "Estimate" });
  revalidatePath(`/admin/projects/${projectId}/estimate`);
}

/** Record a room's floor finish, then re-derive so the floor lines pick
    their real items — the unknown-finish flag exists to be answered. */
export async function setFloorFinishAction(
  projectId: string,
  roomScanId: string,
  finish: string,
): Promise<EstimateSnapshot> {
  await requireSession();
  if (!(FINISHES as readonly string[]).includes(finish)) {
    throw new Error(`Unknown floor finish: ${finish}`);
  }
  await setRoomFloorFinish(roomScanId, finish as Finish);
  return deriveEstimateAction(projectId);
}

// ---------------------------------------------------------------------------
// The AI door. Claude sees the catalogue (codes and names, never rates) and
// the project's real measurements, and returns proposals; the operator
// accepts or dismisses each one. Rejected model output costs nothing.

export type SuggestResult = {
  suggestions: SuggestedLine[];
  /** The model's prose when it had something to say instead of (or beside)
      proposals — shown to the operator as a note, never acted on. */
  message: string | null;
};

const SUGGEST_SYSTEM = `You are the estimating assistant inside Renovision AnA's insurance-restoration CRM (Québec water-damage work). You propose line items for an insurance repair estimate.

HARD RULES:
- Propose items ONLY from the catalogue below, by their exact item code. If work is needed that no catalogue item covers, propose it with itemCode null and a clear name — it will be priced by hand.
- Never state or estimate a price. Pricing happens elsewhere.
- Every quantity must be justified by a measurement or fact in the project context, cited in the rationale.
- Do not repeat lines already on the estimate.
- Prefer remove-and-replace pairs (activity "replace" with removalItemCode + itemCode) where demolition and reinstallation both apply.
- Call the propose_estimate_lines tool with your proposals. If nothing is worth proposing, call it with an empty list and explain in text.`;

export async function suggestLinesAction(
  projectId: string,
  instruction: string,
): Promise<SuggestResult> {
  await requireSession();
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("The AI assistant is not configured (ANTHROPIC_API_KEY).");
  }

  const [estimate, ctx] = await Promise.all([
    getOrCreateDraft(projectId),
    buildEstimateContext(projectId),
  ]);

  const client = new Anthropic();
  const response = await client.messages.create({
    model: "claude-opus-5",
    max_tokens: 8192,
    system: [
      {
        type: "text",
        text: `${SUGGEST_SYSTEM}\n\nCATALOGUE:\n${buildCatalogSummary()}`,
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [PROPOSE_TOOL],
    messages: [
      {
        role: "user",
        content: `PROJECT CONTEXT:\n${buildSuggestionContext(ctx, estimate.lines)}\n\nOPERATOR REQUEST: ${
          instruction.trim().slice(0, 2000) ||
          "Review the project and propose any estimate lines that are missing."
        }`,
      },
    ],
  });

  const rooms = ctx.rooms.map((room) => ({ roomScanId: room.roomScanId, name: room.name }));
  let suggestions: SuggestedLine[] = [];
  const textParts: string[] = [];
  for (const block of response.content) {
    if (block.type === "tool_use" && block.name === PROPOSE_TOOL.name) {
      suggestions = validateProposals(block.input, rooms);
    } else if (block.type === "text" && block.text.trim()) {
      textParts.push(block.text.trim());
    }
  }
  return { suggestions, message: textParts.length > 0 ? textParts.join("\n\n") : null };
}

/** Accept suggestions into the estimate: manual lines, `ai` provenance,
    fresh unique keys, appended and persisted. */
export async function acceptSuggestionsAction(
  projectId: string,
  estimateId: string,
  rawSuggestions: unknown[],
): Promise<EstimateSnapshot> {
  await requireSession();
  const estimate = await getOrCreateDraft(projectId);
  if (estimate.id !== estimateId) throw new Error("The estimate changed — reload the page.");

  const accepted: EstimateLine[] = [];
  for (const raw of rawSuggestions.slice(0, 30)) {
    const line = sanitizeLine({
      ...(typeof raw === "object" && raw !== null ? raw : {}),
      key: `ai:${randomUUID()}`,
      origin: "manual",
      provenance: "ai",
      removed: false,
    });
    if (line) {
      const rationale = (raw as Record<string, unknown>)?.rationale;
      accepted.push(
        acceptedLine(
          {
            itemCode: line.itemCode,
            removalItemCode: line.removalItemCode,
            name: line.name,
            unit: line.unit,
            quantity: line.quantity,
            removeRateCents: line.removeRateCents,
            replaceRateCents: line.replaceRateCents,
            roomScanId: line.roomScanId,
            roomName: line.roomName,
            tradeSection: line.tradeSection,
            activity: line.activity,
            rationale: typeof rationale === "string" ? rationale.slice(0, 400) : "",
            issues: line.issues,
          },
          line.key,
        ),
      );
    }
  }

  const merged = [...estimate.lines, ...accepted];
  await saveLines(estimate.id, merged);
  revalidatePath(`/admin/projects/${projectId}/estimate`);
  return { ...snapshot(estimate), lines: merged };
}
