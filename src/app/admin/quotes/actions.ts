"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isSignedIn } from "@/lib/adminAuth";
import {
  createQuote,
  sendQuote,
  setQuoteArchived,
  setQuoteStatus,
  updateQuote,
  type QuoteInput,
  type QuoteLineInput,
} from "@/lib/crm/quotes";
import { QUOTE_STATUSES, type QuoteStatus } from "@/lib/crm/quoteTypes";

export type QuoteFormState = { error?: string };

async function requireSession(): Promise<void> {
  if (!(await isSignedIn())) throw new Error("Not authorised");
}

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function int(formData: FormData, key: string): number {
  const value = Number(str(formData, key));
  return Number.isFinite(value) ? Math.round(value) : 0;
}

/**
 * Parse the line items.
 *
 * They arrive as one JSON blob because the operator adds, deletes and reorders
 * rows freely, and reindexing `lines[3][unitPrice]` on every delete is a bug
 * factory. The JSON came from a browser, so every field is re-checked here:
 * its shape is a claim, not a fact.
 *
 * The client sends money already converted to integer cents, because the input
 * fields parse as you type — but nothing is trusted, so each value is coerced
 * to a safe integer and the discriminated union is re-enforced.
 */
function parseLines(formData: FormData): QuoteLineInput[] {
  let raw: unknown[];
  try {
    raw = JSON.parse(str(formData, "lines") || "[]") as unknown[];
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];

  return raw
    .flatMap<QuoteLineInput>((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const line = entry as Record<string, unknown>;
      const kind = line.kind === "text" ? "text" : "item";
      const name = String(line.name ?? "").trim();

      // A text line with no words says nothing; a priced line with no name
      // prints as a blank row on the customer's document.
      if (!name) return [];

      if (kind === "text") {
        return [
          {
            kind: "text" as const,
            name: name.slice(0, 500),
            description: String(line.description ?? "").trim().slice(0, 5000) || null,
            optional: false,
            selected: false,
            taxable: false,
          },
        ];
      }

      return [
        {
          kind: "item" as const,
          name: name.slice(0, 500),
          description: String(line.description ?? "").trim().slice(0, 5000) || null,
          quantityMilli: safeInt(line.quantityMilli),
          unit: String(line.unit ?? "").trim().slice(0, 40) || null,
          // Signed: a negative unit price is how a discount line is written.
          unitPriceCents: safeInt(line.unitPriceCents),
          unitCostCents: line.unitCostCents == null ? null : safeInt(line.unitCostCents),
          taxable: line.taxable !== false,
          optional: Boolean(line.optional),
          selected: Boolean(line.optional) && Boolean(line.selected),
          laborHours: line.laborHours == null ? null : Number(line.laborHours) || null,
          priceBookItemId:
            typeof line.priceBookItemId === "string" && line.priceBookItemId
              ? line.priceBookItemId
              : null,
        },
      ];
    })
    .slice(0, 100);
}

/** Coerce to a safe integer, defaulting to 0 rather than letting NaN through. */
function safeInt(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  // Beyond this, integer arithmetic stops being exact — and a quote for more
  // than ninety trillion dollars is a typo, not a job.
  return Math.max(-Number.MAX_SAFE_INTEGER, Math.min(Number.MAX_SAFE_INTEGER, Math.round(n)));
}

function parseInput(formData: FormData): QuoteInput {
  const clientId = str(formData, "clientId");
  if (!clientId) throw new Error("Choose a client for this quote.");

  const language = str(formData, "language") === "en" ? "en" : "fr";
  const discountKind = str(formData, "discountKind");
  const depositKind = str(formData, "depositKind");

  return {
    clientId,
    propertyId: str(formData, "propertyId") || null,
    leadId: str(formData, "leadId") || null,
    title: str(formData, "title") || null,
    taxRateId: str(formData, "taxRateId") || null,
    discountKind:
      discountKind === "amount" || discountKind === "percent" ? discountKind : "none",
    discountValue: int(formData, "discountValue"),
    depositKind: depositKind === "amount" || depositKind === "percent" ? depositKind : "none",
    depositValue: int(formData, "depositValue"),
    clientMessage: str(formData, "clientMessage").slice(0, 10_000) || null,
    contractTerms: str(formData, "contractTerms").slice(0, 20_000) || null,
    internalNotes: str(formData, "internalNotes").slice(0, 10_000) || null,
    showQuantities: formData.get("showQuantities") !== null,
    showUnitPrices: formData.get("showUnitPrices") !== null,
    showLineTotals: formData.get("showLineTotals") !== null,
    showTotalsFooter: formData.get("showTotalsFooter") !== null,
    requireSignature: formData.get("requireSignature") !== null,
    validUntil: str(formData, "validUntil") || null,
    language,
    isItinerant: formData.get("isItinerant") !== null,
    lines: parseLines(formData),
  };
}

export async function createQuoteAction(
  _prev: QuoteFormState,
  formData: FormData,
): Promise<QuoteFormState> {
  await requireSession();

  let id: string;
  try {
    id = await createQuote(parseInput(formData));
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not create the quote." };
  }

  revalidatePath("/admin/quotes");
  // Outside the try: redirect signals by throwing, and catching it would turn
  // a successful save into an error message.
  redirect(`/admin/quotes/${id}`);
}

export async function updateQuoteAction(
  id: string,
  _prev: QuoteFormState,
  formData: FormData,
): Promise<QuoteFormState> {
  await requireSession();

  try {
    await updateQuote(id, parseInput(formData));
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not save the quote." };
  }

  revalidatePath("/admin/quotes");
  revalidatePath(`/admin/quotes/${id}`);
  redirect(`/admin/quotes/${id}`);
}

/**
 * Issue the quote: freeze the tax rate, the client identity and the service
 * address, and mint the public link.
 *
 * Refuses without an RBQ licence number on file. Building Act s. 57.1 requires
 * it on every estimate, quote, contract and statement of account, and omitting
 * it is a penal offence — so this blocks rather than warns.
 */
export async function sendQuoteAction(id: string): Promise<void> {
  await requireSession();
  await sendQuote(id);
  revalidatePath("/admin/quotes");
  revalidatePath(`/admin/quotes/${id}`);
}

export async function setStatusAction(id: string, status: string): Promise<void> {
  await requireSession();
  if (!QUOTE_STATUSES.includes(status as QuoteStatus)) {
    throw new Error(`Unknown status: ${status}`);
  }
  await setQuoteStatus(id, status as QuoteStatus);
  revalidatePath("/admin/quotes");
  revalidatePath(`/admin/quotes/${id}`);
}

export async function archiveQuoteAction(id: string, archived: boolean): Promise<void> {
  await requireSession();
  await setQuoteArchived(id, archived);
  revalidatePath("/admin/quotes");
  revalidatePath(`/admin/quotes/${id}`);
}
