// The insurance-estimate money model, reverse-engineered from four printed
// Xactimate estimates and verified to the cent against their figures — the
// worked examples are in trailer.test.ts and the derivation is
// Docs/Estimator-Xactimate-Conventions.md §1.
//
// Everything is computed PER LINE in integer cents and the document totals
// are sums of the lines. That is not a style choice: the printed documents'
// Sommaire figures (Généraux 1 520,36 on items 15 203,33) are NOT items ×
// 10% (that gives 1 520,33) — they are the sum of each line's rounded
// allocation. Computing the trailer any other way disagrees with the
// reference by a few cents on every document, which is exactly the kind of
// discrepancy an adjuster is paid to notice.

import type { AllocatedLine, EstimateLine, EstimateTotals, TrailerSettings } from "./types";
import { getLineItem } from "../catalog";

function toCents(dollars: number): number {
  return Math.round(dollars * 100);
}

/** qty × (ENLEV + REMPLAC), in cents. Rates already live in cents on the
    line; a null rate contributes nothing (a no-rate line prints its
    quantity and 0,00 — the visible gap of Estimator-Spec.md §3.2).

    The multiplication is done in INTEGERS: quantities are two-decimal by
    contract (units.ts roundQuantity), so qty×100 × rate is exact, and the
    final ÷100 leaves only unambiguous values or exact halves, which
    Math.round rounds half-up. The naive `Math.round(qty * rate)` on doubles
    loses exact half-cent ties downward (4,14 × 2,25 $ = 931,5¢ computes as
    931,4999…) — a one-cent-per-line discrepancy, which is precisely the
    class of error this module exists to not have. */
export function lineBaseCents(line: EstimateLine): number {
  const remove = line.removeRateCents ?? 0;
  const replace = line.replaceRateCents ?? 0;
  return Math.round((Math.round(line.quantity * 100) * (remove + replace)) / 100);
}

/**
 * Attach the per-line O&P and tax allocation:
 *
 *   generals = base × G%                       (rounded)
 *   profit   = (base [+ generals]) × P%        (rounded; basis is a setting)
 *   GST      = (base + generals + profit) × 5%
 *   QST      = (base + generals + profit) × 9,975%
 *   total    = base + O&P + taxes
 *
 * Non-taxable items keep their O&P but carry no tax, splitting the way the
 * consumer path already splits taxable/non-taxable subtotals.
 */
export function allocateLine(line: EstimateLine, settings: TrailerSettings): AllocatedLine {
  const baseCents = lineBaseCents(line);
  const generalsCents = Math.round(baseCents * settings.generalsPct);
  const profitBase =
    settings.profitBasis === "items_plus_generals" ? baseCents + generalsCents : baseCents;
  const profitCents = Math.round(profitBase * settings.profitPct);
  const opCents = generalsCents + profitCents;
  const taxedBase = line.taxable ? baseCents + opCents : 0;
  const gstCents = Math.round(taxedBase * settings.gstPct);
  const qstCents = Math.round(taxedBase * settings.qstPct);

  // Embedded labour counts BOTH sides of the line: an E&R line's removal
  // item carries hours of its own (DEM-TUB is five of them), and a
  // removal-only line keeps its code in removalItemCode with itemCode null.
  // These hours are the subtrahend of any AJUSTEMENTS labour line
  // (Conventions §4) — undercounting them here overbills there.
  const item = line.itemCode ? getLineItem(line.itemCode) : undefined;
  const removalItem = line.removalItemCode ? getLineItem(line.removalItemCode) : undefined;
  const hoursPerUnit = (item?.laborHoursPerUnit ?? 0) + (removalItem?.laborHoursPerUnit ?? 0);
  const laborHours = Math.round(hoursPerUnit * line.quantity * 100) / 100;

  return {
    ...line,
    baseCents,
    generalsCents,
    profitCents,
    opCents,
    gstCents,
    qstCents,
    taxCents: gstCents + qstCents,
    totalCents: baseCents + opCents + gstCents + qstCents,
    laborHours,
  };
}

export function allocateLines(
  lines: EstimateLine[],
  settings: TrailerSettings,
): AllocatedLine[] {
  return lines.map((line) => allocateLine(line, settings));
}

/** The Sommaire: sums of the per-line allocations, nothing recomputed.
    Removed lines (operator-deleted tombstones) are skipped — they exist only
    so the derivation cannot resurrect them. */
export function estimateTotals(lines: AllocatedLine[]): EstimateTotals {
  const totals: EstimateTotals = {
    itemsCents: 0,
    generalsCents: 0,
    profitCents: 0,
    gstCents: 0,
    qstCents: 0,
    totalCents: 0,
    totalLaborHours: 0,
  };
  for (const line of lines) {
    if (line.removed) continue;
    totals.itemsCents += line.baseCents;
    totals.generalsCents += line.generalsCents;
    totals.profitCents += line.profitCents;
    totals.gstCents += line.gstCents;
    totals.qstCents += line.qstCents;
    totals.totalCents += line.totalCents;
    totals.totalLaborHours += line.laborHours;
  }
  totals.totalLaborHours = Math.round(totals.totalLaborHours * 10) / 10;
  return totals;
}

/** Rate lookup for derivation: a price book sell rate in cents, or null for
    a code the book does not carry — never a guess. */
export function rateCents(itemCode: string | null | undefined): number | null {
  if (!itemCode) return null;
  const item = getLineItem(itemCode);
  return item ? toCents(item.salesRate) : null;
}
