// The AI door, pure half. Claude proposes; this module is the border
// control: it builds the context the model sees and validates what comes
// back. The two rules that make the door safe live here, enforced in code
// rather than asked for in the prompt:
//
//   - The model NEVER prices anything. A proposal names an item code and a
//     quantity; every rate is copied from the price book server-side. A
//     code the book does not know becomes a visibly unpriced line — never
//     a priced guess.
//   - A proposal is a PROPOSAL. Nothing here touches the estimate; accepted
//     suggestions enter as manual lines with `ai` provenance, through the
//     same save path as the operator's own edits.

import { getLineItem } from "../catalog";
import { rateCents } from "./trailer";
import { TRADE_SECTIONS } from "./types";
import type {
  Activity,
  EstimateContext,
  EstimateLine,
  TradeSection,
} from "./types";
import { mToLinFt, roundQuantity, sqmToSqFt } from "./units";
import { unitDays } from "../../crm/dryingLog";

export type SuggestedLine = {
  itemCode: string | null;
  removalItemCode: string | null;
  name: string;
  unit: string;
  quantity: number;
  removeRateCents: number | null;
  replaceRateCents: number | null;
  roomScanId: string | null;
  roomName: string;
  tradeSection: TradeSection;
  activity: Activity;
  /** The model's one-line justification — shown beside the suggestion so
      the operator decides with the reasoning in view. */
  rationale: string;
  issues: EstimateLine["issues"];
};

const ACTIVITIES: readonly Activity[] = ["install", "remove", "replace", "detachReset", "memo"];

/** What the model is allowed to return, as a plain tool schema. Validation
    happens on our side regardless — the schema is a hint, the code is the
    law. */
export const PROPOSE_TOOL = {
  name: "propose_estimate_lines",
  description:
    "Propose line items to add to the insurance estimate. Every proposal is reviewed by the operator before it enters the estimate. Use item codes from the catalogue exactly as written; if no catalogue item fits the needed work, set itemCode to null and describe the work in name so it can be priced by hand.",
  input_schema: {
    type: "object" as const,
    properties: {
      proposals: {
        type: "array",
        items: {
          type: "object",
          properties: {
            itemCode: { type: ["string", "null"], description: "Catalogue code, or null when none fits" },
            removalItemCode: { type: ["string", "null"], description: "Paired removal code for remove-and-replace work" },
            name: { type: "string", description: "Line name when itemCode is null" },
            quantity: { type: "number" },
            unit: { type: "string" },
            roomName: { type: ["string", "null"], description: "Room this belongs to, exactly as listed in the context, or null for general conditions" },
            tradeSection: { type: "string", description: "floor | ceiling | walls | trim | plumbing | electrical | misc" },
            activity: { type: "string", description: "install | remove | replace | detachReset" },
            rationale: { type: "string", description: "One sentence: why this line, citing the measurement or observation it rests on" },
          },
          required: ["quantity", "rationale"],
        },
      },
    },
    required: ["proposals"],
  },
};

/** The project as the model sees it: rooms with their real measurements,
    the damage, the objects and their dispositions, the drying record, and
    what is already on the estimate — so it suggests what is missing rather
    than repeating what is there. */
export function buildSuggestionContext(
  ctx: EstimateContext,
  currentLines: EstimateLine[],
): string {
  const parts: string[] = [];

  for (const room of ctx.rooms) {
    const floor = roundQuantity(sqmToSqFt(room.stats.floorAreaSqm));
    const walls = roundQuantity(sqmToSqFt(room.stats.wallAreaNetSqm));
    const perimeter = roundQuantity(mToLinFt(room.stats.perimeterM));
    parts.push(
      `ROOM "${room.name}" (level ${room.stats.level}): floor ${floor} sq ft, net walls ${walls} sq ft, perimeter ${perimeter} lin ft, baseboard ${roundQuantity(mToLinFt(room.baseboardLengthM))} lin ft, ceiling ${roundQuantity(room.stats.ceilingHeightM * 3.28084)} ft, floor finish: ${room.floorFinish ?? "NOT RECORDED"}.`,
    );
    for (const area of room.affectedAreas) {
      parts.push(
        `  DAMAGE "${area.name}": ${area.damage_type} on ${area.surface}${area.wall_index !== null ? ` (wall ${area.wall_index})` : ""}, ${roundQuantity(sqmToSqFt(area.area_sqm))} sq ft.${area.notes ? ` Note: ${area.notes}` : ""}`,
      );
    }
    for (const object of room.objects) {
      if (!object.included) continue;
      parts.push(
        `  OBJECT ${object.kind}${object.name ? ` "${object.name}"` : ""}: disposition ${object.disposition}, ${roundQuantity(mToLinFt(object.width))} lin ft wide × ${object.quantity}.${object.notes ? ` Note: ${object.notes}` : ""}`,
      );
    }
  }

  if (ctx.equipment.length > 0) {
    parts.push(
      `DRYING EQUIPMENT: ${ctx.equipment
        .map(
          (p) =>
            `${p.kind} × ${p.quantity} (${unitDays(p, ctx.asOf)} unit-days)`,
        )
        .join("; ")}.`,
    );
  }
  if (ctx.readings.length > 0) {
    parts.push(`MOISTURE READINGS on file: ${ctx.readings.length}.`);
  }

  const active = currentLines.filter((line) => !line.removed);
  if (active.length > 0) {
    parts.push(
      `ALREADY ON THE ESTIMATE (do not repeat): ${active
        .map((line) => `${line.itemCode ?? line.name} ×${line.quantity} [${line.roomName}]`)
        .join("; ")}.`,
    );
  }

  return parts.join("\n");
}

function toTradeSection(value: unknown): TradeSection {
  return typeof value === "string" && (TRADE_SECTIONS as readonly string[]).includes(value)
    ? (value as TradeSection)
    : "misc";
}

function toActivity(value: unknown): Activity {
  return typeof value === "string" && (ACTIVITIES as readonly string[]).includes(value as Activity)
    ? (value as Activity)
    : "install";
}

/** Turn the model's tool input into safe, priced proposals. Everything the
    model claimed is re-checked; everything money comes from the book. */
export function validateProposals(
  input: unknown,
  rooms: Array<{ roomScanId: string; name: string }>,
): SuggestedLine[] {
  const raw = (input as { proposals?: unknown })?.proposals;
  if (!Array.isArray(raw)) return [];
  const roomByName = new Map(rooms.map((room) => [room.name.toLowerCase(), room]));

  const suggestions: SuggestedLine[] = [];
  for (const entry of raw.slice(0, 30)) {
    if (typeof entry !== "object" || entry === null) continue;
    const p = entry as Record<string, unknown>;

    const quantity = typeof p.quantity === "number" && Number.isFinite(p.quantity) ? p.quantity : 0;
    if (quantity <= 0 || quantity > 100_000) continue;

    const proposedCode = typeof p.itemCode === "string" ? p.itemCode.trim() : "";
    const proposedRemoval =
      typeof p.removalItemCode === "string" ? p.removalItemCode.trim() : "";
    const item = proposedCode ? getLineItem(proposedCode) : undefined;
    const removalItem = proposedRemoval ? getLineItem(proposedRemoval) : undefined;

    const issues: EstimateLine["issues"] = [];
    if (!item && !removalItem) issues.push("no_item");

    const name =
      item?.name ??
      removalItem?.name ??
      (typeof p.name === "string" && p.name.trim() ? p.name.trim().slice(0, 200) : "Proposed work");

    const roomName = typeof p.roomName === "string" ? p.roomName.trim() : "";
    const room = roomByName.get(roomName.toLowerCase()) ?? null;

    suggestions.push({
      itemCode: item ? item.itemCode : null,
      removalItemCode: removalItem ? removalItem.itemCode : null,
      name,
      // The book's unit wins over the model's claim — a proposal in the
      // wrong unit priced at the book's rate would be a silent mispricing.
      unit: item?.unit ?? removalItem?.unit ?? (typeof p.unit === "string" ? p.unit.slice(0, 40) : "each"),
      quantity: roundQuantity(quantity),
      removeRateCents: removalItem ? rateCents(removalItem.itemCode) : null,
      replaceRateCents: item ? rateCents(item.itemCode) : null,
      roomScanId: room?.roomScanId ?? null,
      roomName: room?.name ?? "Frais généraux",
      tradeSection: toTradeSection(p.tradeSection),
      activity: toActivity(p.activity),
      rationale:
        typeof p.rationale === "string" ? p.rationale.trim().slice(0, 400) : "",
      issues,
    });
  }
  return suggestions;
}

/** An accepted suggestion becomes a MANUAL line with `ai` provenance: the
    derivation never overwrites it, and the document remembers which door it
    came through. */
export function acceptedLine(suggestion: SuggestedLine, key: string): EstimateLine {
  return {
    key,
    origin: "manual",
    provenance: "ai",
    roomScanId: suggestion.roomScanId,
    roomName: suggestion.roomName,
    tradeSection: suggestion.tradeSection,
    activity: suggestion.activity,
    itemCode: suggestion.itemCode,
    removalItemCode: suggestion.removalItemCode,
    name: suggestion.name,
    unit: suggestion.unit,
    quantity: suggestion.quantity,
    removeRateCents: suggestion.removeRateCents,
    replaceRateCents: suggestion.replaceRateCents,
    calc: suggestion.rationale ? `AI suggestion — ${suggestion.rationale}` : "AI suggestion",
    note: null,
    issues: suggestion.issues,
    taxable: true,
    removed: false,
  };
}
