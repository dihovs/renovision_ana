import { RATE_SCALE, type TaxRate } from "./settings";

/**
 * Quote and invoice arithmetic.
 *
 * EVERY amount in this module is an integer number of cents. Not dollars, not
 * floats. `0.1 + 0.2 !== 0.3` is a curiosity in most code and a customer
 * complaint in this one — a quote that totals a cent differently each time it
 * is opened is a quote nobody trusts.
 *
 * The order of operations below is not arbitrary and must not be "simplified":
 * rounding per line and rounding at the end give different answers, and the
 * per-line one is what the customer sees when they add up the column
 * themselves. That is the number that has to reconcile.
 */

/** Quantities are fractional (320.5 sq ft); money never is. */
export type LineForTotals = {
  quantityMilli: number;
  unitPriceCents: number;
  taxable: boolean;
  /** Optional lines only count once the customer has ticked them. */
  optional: boolean;
  selected: boolean;
};

export type DiscountKind = "none" | "amount" | "percent";

export type Discount = {
  kind: DiscountKind;
  /** Cents when kind is "amount"; hundredths of a percent when "percent". */
  value: number;
};

export type TaxLine = { name: string; cents: number };

export type QuoteTotals = {
  /** Every included line, summed. */
  subtotalCents: number;
  taxableSubtotalCents: number;
  nonTaxableSubtotalCents: number;
  /** What the discount actually took off, after clamping. */
  discountCents: number;
  /** Bases after the discount, which is what tax is charged on. */
  adjustedTaxableCents: number;
  adjustedNonTaxableCents: number;
  taxes: TaxLine[];
  totalTaxCents: number;
  totalCents: number;
  /** Present only when the quote asks for a deposit. */
  depositCents: number | null;
  balanceCents: number | null;
};

/**
 * Quantities are stored as thousandths so "0.5 hours" and "12.375 sq ft" are
 * exact integers in the database. A float column would reintroduce the same
 * drift the cents are there to prevent, one layer down.
 */
export const QUANTITY_SCALE = 1000;

/** Percent values are hundredths of a percent: 12.5% is 1250. */
export const PERCENT_SCALE = 10_000;

/**
 * One line's total: quantity x unit price, rounded to the cent HERE, before
 * anything is added together. This is step 1 and it is load-bearing — a
 * customer checking the column with a calculator adds the printed line totals,
 * so those printed values have to be the ones that sum to the subtotal.
 */
export function lineTotalCents(line: Pick<LineForTotals, "quantityMilli" | "unitPriceCents">): number {
  return Math.round((line.quantityMilli * line.unitPriceCents) / QUANTITY_SCALE);
}

/** A line counts toward the total unless it is an unticked optional. */
export function isIncluded(line: LineForTotals): boolean {
  return !line.optional || line.selected;
}

export function calculateQuoteTotals(
  lines: LineForTotals[],
  taxRate: TaxRate,
  discount: Discount = { kind: "none", value: 0 },
  deposit: Discount = { kind: "none", value: 0 },
): QuoteTotals {
  const included = lines.filter(isIncluded);

  // Step 1 and 2: per-line rounding, then split by taxability. Negative-price
  // lines (Jobber's discount-line-item idiom) fall out naturally here — they
  // reduce whichever subtotal they belong to, which is why a discount line
  // must carry the same taxable flag as the work it is discounting.
  let taxableSubtotalCents = 0;
  let nonTaxableSubtotalCents = 0;
  for (const line of included) {
    const total = lineTotalCents(line);
    if (line.taxable) taxableSubtotalCents += total;
    else nonTaxableSubtotalCents += total;
  }
  const subtotalCents = taxableSubtotalCents + nonTaxableSubtotalCents;

  // Step 3: the global discount, applied to the non-taxable base first and the
  // remainder against the taxable one. Doing it the other way round would
  // shrink the tax base further and quietly understate the tax owed.
  const discountCents = resolveDiscountCents(discount, subtotalCents);
  const takenFromNonTaxable = Math.min(discountCents, Math.max(0, nonTaxableSubtotalCents));
  const takenFromTaxable = discountCents - takenFromNonTaxable;

  const adjustedNonTaxableCents = nonTaxableSubtotalCents - takenFromNonTaxable;
  const adjustedTaxableCents = taxableSubtotalCents - takenFromTaxable;

  // Step 4: each component charged on the adjusted taxable base. GST and QST
  // are both computed from that same base and summed — Quebec de-harmonised in
  // 2013, so QST is NOT charged on top of GST. Compounding them would overstate
  // every quote by about half a percent.
  //
  // A negative base (a credit note, or discounts exceeding the taxable work)
  // must still produce negative tax, so this deliberately does not clamp.
  const taxes: TaxLine[] = taxRate.components.map((component) => ({
    name: component.name,
    cents: Math.round((adjustedTaxableCents * component.rate) / RATE_SCALE),
  }));
  const totalTaxCents = taxes.reduce((sum, tax) => sum + tax.cents, 0);

  // Step 5 in the documented order is "round the final total". Everything here
  // is already an integer number of cents, so it is a no-op — which is the
  // point of working in cents rather than a reason to skip the discipline.
  const totalCents = adjustedNonTaxableCents + adjustedTaxableCents + totalTaxCents;

  const depositCents = deposit.kind === "none" ? null : resolveDiscountCents(deposit, totalCents);

  return {
    subtotalCents,
    taxableSubtotalCents,
    nonTaxableSubtotalCents,
    discountCents,
    adjustedTaxableCents,
    adjustedNonTaxableCents,
    taxes,
    totalTaxCents,
    totalCents,
    depositCents,
    balanceCents: depositCents === null ? null : totalCents - depositCents,
  };
}

/**
 * Turn a discount (or deposit) into cents against a base.
 *
 * Clamped to the base and to zero. A discount larger than the quote would
 * otherwise produce a negative total — which reads as the company paying the
 * customer, and is far more likely a typo than an intention.
 */
function resolveDiscountCents(discount: Discount, baseCents: number): number {
  if (discount.kind === "none" || discount.value <= 0) return 0;
  const raw =
    discount.kind === "percent"
      ? Math.round((baseCents * discount.value) / (PERCENT_SCALE * 100))
      : discount.value;
  return Math.max(0, Math.min(raw, Math.max(0, baseCents)));
}

// ---------------------------------------------------------------------------
// Parsing and formatting
// ---------------------------------------------------------------------------

/**
 * Parse what a person actually types into a money field.
 *
 * Handles "1,234.56", "1 234,56", "$1234.56", "1234", "-50" and blank. The
 * comma-as-decimal case is not an edge case here: this is Quebec, the CRM
 * runs in French half the time, and a French keyboard produces "1 234,56 $".
 * Reading that as 123456 dollars would be a hundred-fold error on a quote.
 */
export function parseMoneyToCents(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const negative = /^-/.test(trimmed) || /^\(.*\)$/.test(trimmed);
  // Strip currency symbols, spaces (including the narrow no-break space French
  // formatting uses as a thousands separator), and the sign.
  let cleaned = trimmed.replace(/[$\s  ()-]/g, "");

  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");

  if (lastComma >= 0 && lastDot >= 0) {
    // Both present: whichever comes last is the decimal separator, and the
    // other is grouping. "1.234,56" and "1,234.56" both resolve correctly.
    const decimalAt = Math.max(lastComma, lastDot);
    const groupChar = decimalAt === lastComma ? "." : ",";
    cleaned = cleaned.split(groupChar).join("");
    cleaned = cleaned.replace(/[.,]/, ".");
  } else if (lastComma >= 0) {
    // A lone comma is a decimal separator when it has 1-2 digits after it,
    // and a thousands separator otherwise: "1,5" is 1.50, "1,500" is 1500.
    const after = cleaned.length - lastComma - 1;
    cleaned = after <= 2 ? cleaned.replace(",", ".") : cleaned.split(",").join("");
  } else if (lastDot >= 0) {
    const after = cleaned.length - lastDot - 1;
    if (after > 2) cleaned = cleaned.split(".").join("");
  }

  if (!/^\d*\.?\d*$/.test(cleaned) || cleaned === "" || cleaned === ".") return null;

  const cents = Math.round(Number(cleaned) * 100);
  if (!Number.isFinite(cents)) return null;
  return negative ? -cents : cents;
}

/** Same idea for quantities, which are thousandths rather than hundredths. */
export function parseQuantityToMilli(input: string): number | null {
  const cents = parseMoneyToCents(input);
  if (cents === null) return null;
  // parseMoneyToCents rounds to 2dp; quantities allow 3, so re-read the raw
  // decimal rather than scaling a value that has already lost a digit.
  const cleaned = input.trim().replace(/[$\s  ]/g, "").replace(",", ".");
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return cents * 10;
  return Math.round(value * QUANTITY_SCALE);
}

const FORMATTERS = new Map<string, Intl.NumberFormat>();

function formatter(locale: string): Intl.NumberFormat {
  const key = locale === "fr" ? "fr-CA" : "en-CA";
  let existing = FORMATTERS.get(key);
  if (!existing) {
    existing = new Intl.NumberFormat(key, {
      style: "currency",
      currency: "CAD",
      currencyDisplay: "symbol",
    });
    FORMATTERS.set(key, existing);
  }
  return existing;
}

/** "$1,234.56" in English, "1 234,56 $" in French. */
export function formatMoney(cents: number, locale: "en" | "fr" = "en"): string {
  return formatter(locale).format(cents / 100);
}

/** Quantities print without trailing zeros: 12, 12.5, 12.375. */
export function formatQuantity(milli: number): string {
  const value = milli / QUANTITY_SCALE;
  return value.toFixed(3).replace(/\.?0+$/, "");
}

/** "12.5%" from hundredths of a percent. */
export function formatPercent(hundredths: number): string {
  return `${(hundredths / PERCENT_SCALE).toFixed(2).replace(/\.?0+$/, "")}%`;
}
