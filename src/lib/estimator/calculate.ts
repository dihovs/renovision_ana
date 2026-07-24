import { getLineItem } from "./catalog";
import type { EstimateLine, EstimateResult, ScopeLine } from "./types";

// Quebec sales taxes. GST and QST are each computed on the pre-tax subtotal
// (Quebec has not charged QST-on-GST since 2013), each rounded independently
// to the nearest cent — the standard Revenu Québec convention.
const GST_RATE = 0.05;
const QST_RATE = 0.09975;

// All money is handled in integer cents to avoid floating-point drift. A sell
// rate like 9.95 is stored as a JS number in the catalog; we convert once, at
// the boundary, with rounding — never accumulate in floating point.
function toCents(dollars: number): number {
  return Math.round(dollars * 100);
}

/**
 * The preliminary band. Instant estimates from a chat conversation carry real
 * uncertainty (concealed conditions, exact finishes, site access), so we show
 * a range around the computed subtotal rather than a single false-precision
 * number: -15% low, +25% high. The midpoint is the actual calculated subtotal.
 */
const LOW_FACTOR = 0.85;
const HIGH_FACTOR = 1.25;

/**
 * Price a set of scope lines against the real catalog. The model supplies item
 * codes and quantities; every price, tax and total is computed here — the model
 * never sees a rate or produces a dollar figure. Unknown codes are collected
 * and skipped, not guessed at.
 */
export function calculateEstimate(scope: ScopeLine[]): EstimateResult {
  const lines: EstimateLine[] = [];
  const unknownItemCodes: string[] = [];
  const exclusionSet = new Set<string>();

  let taxableSubtotalCents = 0;
  let nonTaxableSubtotalCents = 0;
  let totalLaborHours = 0;

  for (const entry of scope) {
    const item = getLineItem(entry.itemCode);
    if (!item) {
      unknownItemCodes.push(entry.itemCode);
      continue;
    }

    const quantity = Number.isFinite(entry.quantity) && entry.quantity > 0 ? entry.quantity : 0;
    if (quantity === 0) continue;

    const unitRateCents = toCents(item.salesRate);
    const lineTotalCents = Math.round(unitRateCents * quantity);
    const laborHours = Math.round(item.laborHoursPerUnit * quantity * 100) / 100;

    if (item.taxable) {
      taxableSubtotalCents += lineTotalCents;
    } else {
      nonTaxableSubtotalCents += lineTotalCents;
    }
    totalLaborHours += laborHours;

    if (item.exclusions) exclusionSet.add(item.exclusions);

    lines.push({
      itemCode: item.itemCode,
      name: item.name,
      unit: item.unit,
      quantity,
      unitRateCents,
      lineTotalCents,
      laborHours,
      taxable: item.taxable,
      exclusions: item.exclusions,
    });
  }

  const subtotalCents = taxableSubtotalCents + nonTaxableSubtotalCents;
  const gstCents = Math.round(taxableSubtotalCents * GST_RATE);
  const qstCents = Math.round(taxableSubtotalCents * QST_RATE);
  const totalCents = subtotalCents + gstCents + qstCents;

  return {
    lines,
    taxableSubtotalCents,
    nonTaxableSubtotalCents,
    subtotalCents,
    gstCents,
    qstCents,
    totalCents,
    totalLaborHours: Math.round(totalLaborHours * 10) / 10,
    lowCents: Math.round(subtotalCents * LOW_FACTOR),
    expectedCents: subtotalCents,
    highCents: Math.round(subtotalCents * HIGH_FACTOR),
    unknownItemCodes,
    exclusions: [...exclusionSet],
  };
}

const CAD = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  maximumFractionDigits: 0,
});

const CAD_PRECISE = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Whole-dollar formatting for the customer-facing range. */
export function formatCents(cents: number): string {
  return CAD.format(cents / 100);
}

/** Cent-precise formatting for internal / lead-email breakdowns. */
export function formatCentsPrecise(cents: number): string {
  return CAD_PRECISE.format(cents / 100);
}
