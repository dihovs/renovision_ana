// The insurance-estimate line model, shaped by four real Xactimate estimates
// from the owner's claims — see Docs/Estimator-Xactimate-Conventions.md for
// where every field comes from. This is deliberately a separate model from
// the consumer-quote path in ../calculate.ts: a consumer quote taxes its
// subtotal with no overhead trailer; an insurance estimate carries per-line
// O&P and taxes on top of it, and the two must not share arithmetic.

import type { StatisticsRoom } from "../../crm/projectStatistics";
import type { AffectedArea } from "../../crm/areaShapes";
import type { RoomObject } from "../../crm/roomObjects";
import type { EquipmentPlacement, MoistureReading } from "../../crm/dryingLog";

/** What is being done, Xactimate's activity model. "replace" is E&R — one
    line carrying both a removal rate (ENLEV) and a replacement rate
    (REMPLAC). "detachReset" is Détacher et réinstaller, which the price book
    cannot price yet — those lines derive with no rate, visibly (§3.2). */
export type Activity = "install" | "remove" | "replace" | "detachReset" | "memo";

/** Print grouping inside a room, in the reference's fixed order. */
export const TRADE_SECTIONS = [
  "floor",
  "ceiling",
  "walls",
  "trim",
  "plumbing",
  "electrical",
  "misc",
] as const;
export type TradeSection = (typeof TRADE_SECTIONS)[number];

export type LineIssue =
  /** The rule found no price book item for this work. The line still
      appears, with quantity and unit — a visible gap gets filled; a
      plausible invention gets sent to an insurer. */
  | "no_item"
  /** The room's floor finish is not recorded, so removal/install items
      cannot be chosen. */
  | "unknown_finish";

export type EstimateLine = {
  /** Stable identity: ruleId + the subject it derived from. What re-running
      the derivation uses to replace derived lines without touching manual
      ones (§3.1). */
  key: string;
  /** Derived lines are replaced on every re-run; manual lines are never
      touched. A derived line the operator edits must be flipped to manual
      by the editor. */
  origin: "derived" | "manual";
  /** Where the line came from — the audit trail an adjuster asks for. The
      rules engine writes "rule"; an accepted AI suggestion enters as a
      manual line with "ai"; a hand-added line is "operator". Orthogonal to
      `origin`, which is only the merge contract. */
  provenance: "rule" | "ai" | "operator";
  /** Null for project-level lines — the "Frais généraux" pseudo-room. */
  roomScanId: string | null;
  roomName: string;
  tradeSection: TradeSection;
  activity: Activity;
  /** The install/replace-side price book code, or null when no item exists
      for this work. */
  itemCode: string | null;
  /** The removal-side code on an E&R line — its rate prints as ENLEV. */
  removalItemCode: string | null;
  name: string;
  unit: string;
  quantity: number;
  /** ENLEV — removal rate in integer cents, null when the line has no
      removal side or the code is unpriced. */
  removeRateCents: number | null;
  /** REMPLAC — install/replace rate in integer cents. */
  replaceRateCents: number | null;
  /** The measurement citation, printed like Xactimate's CALC column:
      which figure this quantity came from and any arithmetic applied. */
  calc: string;
  note: string | null;
  issues: LineIssue[];
  taxable: boolean;
  /** An operator-deleted line. Deleting a DERIVED line cannot simply drop the
      row — the next derivation would resurrect it — so deletion flips it to
      manual and sets this flag: the tombstone survives every re-run, prints
      nowhere, and totals skip it. */
  removed: boolean;
};

/** A rule emits one or more of these; derivation resolves codes to rates. */
export type RuleLine = {
  /** Stable identity of this line WITHIN its rule + subject, used to build
      the merge key. Must not depend on array position: an ordinal re-keys
      every sibling when a line is added or removed, silently orphaning the
      operator's edits (the §3.1 contract breaks). Defaults to the item code
      when absent; rules whose lines have no distinguishing code must set it. */
  keyHint?: string;
  itemCode: string | null;
  removalItemCode?: string | null;
  /** Display name when itemCode is null (no book item to take a name from). */
  label?: string;
  activity: Activity;
  tradeSection: TradeSection;
  unit: string;
  quantity: number;
  calc: string;
  note?: string;
  issues?: LineIssue[];
};

export type FloorFinish = "laminate" | "lvp" | "engineered" | "hardwood" | "carpet" | "tile";

/** One room's slice of the project, everything a rule may cite. All figures
    are the same ones the report prints — the estimator measures nothing
    itself (Estimator-Spec.md §2). */
export type EstimateRoom = {
  roomScanId: string;
  name: string;
  stats: StatisticsRoom;
  /** Wall length per wall index, plan metres — pairs with a wall area's
      wall_index for baseboard and per-wall quantities. */
  wallLengthsM: number[];
  /** What baseboard is actually priced against: the perimeter MINUS the
      doorways — trim does not run across a doorway. The app already computes
      this (roomScan.ts baseboardLengthMeters); the perimeter is the wrong
      figure for linear-foot trim and the codebase says so in as many words. */
  baseboardLengthM: number;
  floorFinish: FloorFinish | null;
  affectedAreas: AffectedArea[];
  objects: RoomObject[];
};

export type EstimateContext = {
  rooms: EstimateRoom[];
  equipment: EquipmentPlacement[];
  readings: MoistureReading[];
  /** Open-ended equipment placements bill up to this moment. */
  asOf: Date;
};

/** The document trailer, configurable because it is a firm convention, not a
    constant: Polygon computes profit on items + generals (per-line 15,5%),
    Restauration CT on items alone (15,0%). Both are real documents. */
export type TrailerSettings = {
  generalsPct: number;
  profitPct: number;
  profitBasis: "items_plus_generals" | "items";
  gstPct: number;
  qstPct: number;
};

export const POLYGON_TRAILER: TrailerSettings = {
  generalsPct: 0.1,
  profitPct: 0.05,
  profitBasis: "items_plus_generals",
  gstPct: 0.05,
  qstPct: 0.09975,
};

/** A line with its O&P and tax allocation attached — what actually prints. */
export type AllocatedLine = EstimateLine & {
  baseCents: number;
  generalsCents: number;
  profitCents: number;
  /** generalsCents + profitCents — the printed "Frais généraux et profit". */
  opCents: number;
  gstCents: number;
  qstCents: number;
  /** gstCents + qstCents — the printed TAXE column. */
  taxCents: number;
  totalCents: number;
  laborHours: number;
};

export type EstimateTotals = {
  /** "Ligne du total des articles" — Σ line bases. */
  itemsCents: number;
  generalsCents: number;
  profitCents: number;
  gstCents: number;
  qstCents: number;
  /** "Valeur à neuf". The reference documents print Sinistre net equal to
      it — depreciation is left to the insurer by cover-letter paragraph,
      never computed (Conventions §1). */
  totalCents: number;
  totalLaborHours: number;
};
