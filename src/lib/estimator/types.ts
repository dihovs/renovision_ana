// Shared types for the line-item estimator. The data itself lives in ./data,
// generated from the company's QuickBooks-style cost database. Only
// customer-facing sales rates are stored here — never internal costs or margins.

export type LaborClass =
  | "LAB-TECH"
  | "LAB-HELPER"
  | "LAB-FOREMAN"
  | "LAB-PAINTER"
  | "LAB-TILER"
  | "LAB-DRYWALL"
  | "LAB-CARPENTER"
  | "LAB-PM";

export type Unit =
  | "sq ft"
  | "linear ft"
  | "each"
  | "hour"
  | "day"
  | "job"
  | "room"
  | "load"
  | "trip"
  | "visit"
  | "call"
  | "report"
  | "allowance";

export type LineItem = {
  itemCode: string;
  category: string;
  subcategory: string;
  name: string;
  unit: string;
  /** Customer-facing installed sell rate per unit, in CAD. */
  salesRate: number;
  laborHoursPerUnit: number;
  laborClass: string;
  taxable: boolean;
  keywords: string;
  exclusions: string | null;
};

/** One line Claude asks the backend to price: an item code + a quantity. */
export type ScopeLine = {
  itemCode: string;
  quantity: number;
};

/** A validated, priced line ready to show or store. */
export type EstimateLine = {
  itemCode: string;
  name: string;
  unit: string;
  quantity: number;
  /** salesRate in integer cents (decimal-safe). */
  unitRateCents: number;
  /** quantity × unitRate, in integer cents. */
  lineTotalCents: number;
  /** Estimated crew hours for this line (laborHoursPerUnit × quantity). Owner-side only. */
  laborHours: number;
  taxable: boolean;
  exclusions: string | null;
};

export type EstimateResult = {
  lines: EstimateLine[];
  /** Sum of all taxable line totals, integer cents. */
  taxableSubtotalCents: number;
  /** Sum of all non-taxable line totals, integer cents. */
  nonTaxableSubtotalCents: number;
  subtotalCents: number;
  gstCents: number;
  qstCents: number;
  totalCents: number;
  /** Sum of estimated crew hours across all lines. Owner-side only. */
  totalLaborHours: number;
  /** Low / expected / high band on the pre-tax subtotal, integer cents. */
  lowCents: number;
  expectedCents: number;
  highCents: number;
  /** Item codes Claude referenced that did not exist in the catalog. */
  unknownItemCodes: string[];
  /** Distinct exclusion notes gathered from the selected lines. */
  exclusions: string[];
};
