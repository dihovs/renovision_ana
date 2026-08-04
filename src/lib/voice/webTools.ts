import type Anthropic from "@anthropic-ai/sdk";
import { buildCatalogSummary } from "@/lib/estimator/catalog";
import { calculateEstimate, formatCents } from "@/lib/estimator/calculate";
import type { ScopeLine } from "@/lib/estimator/types";

/**
 * Ana's pricing tool, for the website widget only.
 *
 * The phone agent (systemPrompt() in agent.ts, channel "phone") is built with
 * no pricing tool and no catalog at all — a price spoken on a call becomes a
 * promise, and the deliberate guardrail there is structural: it cannot quote
 * a number because it has no number to quote. The website widget is a
 * different trust context, the same one the existing text chat estimator
 * (src/app/api/chat/chatTools.ts) already operates in — a written or spoken
 * range with a disclaimer attached, not a figure read down a phone line to
 * someone who may act on it as final. This tool exists so Ana can do on the
 * website exactly what that chat estimator already does: price a scope
 * against the real catalog and hand back a range.
 *
 * ONE DIFFERENCE FROM THE TEXT ESTIMATOR'S TOOL: that one withholds the
 * dollar figures from Claude entirely — the backend emits them straight to
 * the browser UI as a separate structured event, and Claude is told only
 * that pricing succeeded, specifically so it cannot restate (and possibly
 * mis-transcribe) a number. Ana has no such side channel — the ONLY way the
 * customer receives a number is what she says or types — so this tool
 * returns the number already formatted as the exact sentence to relay. This
 * mirrors the pattern ownerSystemPrompt() already uses for money the CRM
 * tools return: "say them as they are given," never recomputed or rephrased.
 */

const CATALOG_SUMMARY = buildCatalogSummary();

export function webCatalogSummary(): string {
  return CATALOG_SUMMARY;
}

export const WEB_ESTIMATE_TOOL: Anthropic.Tool = {
  name: "build_estimate",
  description:
    "Price a preliminary estimate from Renovision AnA's cost catalog. Provide the scope as " +
    "an array of catalog item codes and quantities, plus a short plain-language summary of " +
    "the job. Use ONLY item codes that appear in the catalog given in the system prompt — " +
    "never invent a code, a unit, or a price. The backend prices every line, applies Quebec " +
    "taxes, and returns the exact sentence to say back to the customer — read it back as " +
    "given, do not recompute or alter the numbers in it.",
  input_schema: {
    type: "object",
    properties: {
      scopeSummary: {
        type: "string",
        description:
          "One or two sentences describing the job in plain language (what, where, size), for the customer's records.",
      },
      lines: {
        type: "array",
        description:
          "The estimate line items. Each references a catalog item code and the quantity in that item's unit (e.g. square feet, linear feet, or 'each').",
        items: {
          type: "object",
          properties: {
            itemCode: {
              type: "string",
              description: "Exact catalog item code, e.g. FLR-LAM-INST.",
            },
            quantity: {
              type: "number",
              description: "Quantity in the item's own unit. Must be greater than 0.",
            },
          },
          required: ["itemCode", "quantity"],
        },
      },
    },
    required: ["scopeSummary", "lines"],
  },
};

type WebEstimateInput = {
  scopeSummary?: unknown;
  lines?: unknown;
};

function toScope(input: unknown): ScopeLine[] {
  const raw = input as WebEstimateInput | null | undefined;
  const lines = Array.isArray(raw?.lines) ? raw.lines : [];
  return lines
    .filter(
      (l): l is { itemCode: string; quantity: number } =>
        !!l &&
        typeof l === "object" &&
        typeof (l as { itemCode?: unknown }).itemCode === "string" &&
        typeof (l as { quantity?: unknown }).quantity === "number",
    )
    .map((l) => ({ itemCode: l.itemCode, quantity: l.quantity }));
}

const NO_VALID_LINES = {
  fr: "Aucun article valide du catalogue n'a pu être chiffré. Demande au client de préciser la portée des travaux.",
  en: "No valid catalog items were priced. Ask the customer for a clearer scope.",
} as const;

/**
 * Same wording the text chat estimator shows the customer (i18n `chat.estimate`
 * strings) — one range, one disclaimer — so the two channels say the same
 * thing about the same job.
 */
function estimateSentence(locale: "fr" | "en", low: string, high: string): string {
  return locale === "fr"
    ? `D'après ce que vous avez partagé, voici une fourchette d'estimation approximative : ${low} – ${high}. Il s'agit d'une approximation automatisée, non d'une soumission finale. Le prix final dépend d'une inspection en personne ou par photos.`
    : `Based on what you've shared, here's a rough estimate range: ${low} – ${high}. This is an automated approximation, not a final quote. Final pricing depends on an in-person or photo-based inspection.`;
}

const UNKNOWN_CODES_NOTE = {
  fr: (codes: string[]) => ` Codes inconnus ignorés : ${codes.join(", ")} — n'invente jamais de code.`,
  en: (codes: string[]) => ` Ignored unknown item codes: ${codes.join(", ")} — do not invent codes.`,
} as const;

/** Runs build_estimate against the real catalog and returns the tool_result content. */
export function runWebEstimateTool(input: unknown, locale: "fr" | "en"): string {
  const scope = toScope(input);
  const result = calculateEstimate(scope);

  if (result.lines.length === 0) {
    return NO_VALID_LINES[locale] + (result.unknownItemCodes.length ? UNKNOWN_CODES_NOTE[locale](result.unknownItemCodes) : "");
  }

  const sentence = estimateSentence(locale, formatCents(result.lowCents), formatCents(result.highCents));
  const unknownNote = result.unknownItemCodes.length ? UNKNOWN_CODES_NOTE[locale](result.unknownItemCodes) : "";
  return `${sentence}${unknownNote}`;
}
