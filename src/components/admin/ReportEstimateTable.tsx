import { Fragment } from "react";
import type { Locale } from "@/i18n/translations";
import { formatNumber, REPORT_STRINGS } from "@/lib/report/strings";
import { lineItemName, unitLabel } from "@/lib/estimator/catalog";
import {
  TRADE_SECTIONS,
  type AllocatedLine,
  type EstimateTotals,
  type TradeSection,
  type TrailerSettings,
} from "@/lib/estimator/insurance/types";

/**
 * Templates H (takeoff) and I (estimate summary) from
 * `Docs/Report-Estimate-Blueprint.md`, as one printable section.
 *
 * **Why one component and not two pages hand-built per report.** The
 * blueprint has described this page since it was written; `ReportDocument`
 * never rendered it, so every priced job left the app as a JSON blob or a
 * console dump (see `tansley.sample.test.ts`) instead of a page in the
 * document the owner hands to an adjuster. That is a gap in the report
 * format, not a one-off need of this job — so it takes the shape of the
 * report's other sections instead of a print routine bolted onto one
 * render script: `AllocatedLine[]` and `EstimateTotals` are exactly what
 * `allocateLines`/`estimateTotals` in `trailer.ts` already produce, so any
 * future estimate — not only this one — prints by passing its own lines in.
 *
 * **The column set is Xactimate's, per `Docs/Estimator-Xactimate-
 * Conventions.md` §2**: item, CAT (trade section)/code, description with
 * its CALC line printed underneath (the arithmetic, not just the answer —
 * "an asserted quantity is reducible; a quantity with its arithmetic beside
 * it has to be argued with"), quantity, base, Frais généraux et profit,
 * total. Grouped by room then by trade section, in the fixed order the
 * conventions doc lists (Plancher/Plafond/Murs/Boiseries/Plomberie/
 * Électricité/Divers) — the same order a real Xactimate estimate prints in
 * and the order `TRADE_SECTIONS` already encodes.
 *
 * **Grouped by APARTMENT above the room, where there is more than one.** A
 * triplex is one claim and three households, and a devis that runs the three
 * units together makes the reader work out which line priced which door. So
 * `ReportDocument` cuts the estimate into one block per unit — each printed
 * at the end of that unit's own section of the report, each closing on its
 * own « Sous-total — Appartement 103 » — and the project-level lines and the
 * one grand sommaire print last. The `#` column still runs 1..n exactly once
 * across the whole document: see `groupLinesByApartment` and `startIndex`.
 * With no apartment on any line this is one block with one sommaire, which
 * is what every single-unit job prints and what this printed before.
 *
 * **What this deliberately does not do.** Depreciation/ACV columns — the
 * conventions doc is explicit that Québec restorers leave that to the
 * insurer by cover-letter paragraph, never a computed column (§1). And no
 * new visual language: every class below is one the report's own pages
 * already use (`marker`, `listing`, `num`, `total`, `fineprint`) — see
 * `report.css` — so this page reads as part of the same document instead of
 * a spreadsheet stapled behind it.
 */

const SECTION_LABEL: Record<Locale, Record<TradeSection, string>> = {
  fr: {
    floor: "Plancher",
    ceiling: "Plafond",
    walls: "Murs",
    trim: "Boiseries",
    plumbing: "Plomberie",
    electrical: "Électricité",
    misc: "Divers",
  },
  en: {
    floor: "Floor",
    ceiling: "Ceiling",
    walls: "Walls",
    trim: "Trim",
    plumbing: "Plumbing",
    electrical: "Electrical",
    misc: "Misc",
  },
};

const TRAILER_LABEL: Record<Locale, {
  items: string;
  generals: (pct: string) => string;
  profit: (pct: string, basis: string) => string;
  profitBasisGP: string;
  profitBasisItems: string;
  gst: (pct: string) => string;
  qst: (pct: string) => string;
  total: string;
  labor: string;
  frGeneraux: string;
}> = {
  fr: {
    items: "Ligne du total des articles",
    generals: (pct) => `Généraux ${pct}`,
    profit: (pct, basis) => `Profit ${pct} (${basis})`,
    profitBasisGP: "articles + généraux",
    profitBasisItems: "articles",
    gst: (pct) => `TPS ${pct}`,
    qst: (pct) => `TVQ ${pct}`,
    total: "VALEUR À NEUF",
    labor: "Main-d'œuvre incorporée",
    frGeneraux: "Frais généraux",
  },
  en: {
    items: "Items subtotal",
    generals: (pct) => `Overhead ${pct}`,
    profit: (pct, basis) => `Profit ${pct} (${basis})`,
    profitBasisGP: "items + overhead",
    profitBasisItems: "items",
    gst: (pct) => `GST ${pct}`,
    qst: (pct) => `QST ${pct}`,
    total: "REPLACEMENT COST VALUE",
    labor: "Labor incorporated",
    frGeneraux: "General conditions",
  },
};

function money(locale: Locale, cents: number): string {
  return (cents / 100).toLocaleString(locale === "fr" ? "fr-CA" : "en-CA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * A rate, as the document writes it.
 *
 * `9.975%` on a French page is the same defect as `78.64 m²`: on a sommaire
 * that is six numbers, one anglophone decimal point is a sixth of the page.
 * The narrow no-break space before the sign is the French typographic rule
 * (and what stops `9,975` and `%` landing on different lines) — the same
 * rule `formatNumber` follows for `m²`.
 */
function pct(locale: Locale, value: number): string {
  const p = value * 100;
  const digits = Number.isInteger(p) ? 0 : Number.isInteger(p * 10) ? 1 : 3;
  const figure = formatNumber(locale, p, digits);
  return locale === "fr" ? `${figure}\u202f%` : `${figure}%`;
}

/** A quantity, with its unit — `437,22 pi²`, never `437.22 sq ft`. Quantities
    are two-decimal by contract (`units.ts roundQuantity`), and printing a
    trailing `,5` where the reference prints `,50` is the other half of
    looking like a devis. */
function quantity(locale: Locale, value: number, unit: string): string {
  return `${formatNumber(locale, value, 2)} ${unitLabel(unit, locale)}`;
}

/** One room's slice of the takeoff/estimate table — item rows plus a
    room subtotal, the same "Totaux : <room>" cascade the conventions doc
    documents (§3.4), collapsed to the one figure a report reader checks
    first: this room's own total. */
function RoomSection({
  roomName,
  lines,
  locale,
  startIndex,
}: {
  roomName: string;
  lines: AllocatedLine[];
  locale: Locale;
  startIndex: number;
}) {
  const bySection = new Map<TradeSection, AllocatedLine[]>();
  for (const line of lines) {
    const list = bySection.get(line.tradeSection) ?? [];
    list.push(line);
    bySection.set(line.tradeSection, list);
  }
  const roomTotalCents = lines.reduce((sum, l) => sum + l.totalCents, 0);
  let running = startIndex;

  return (
    <div className="estimate-room">
      <p className="marker marker-2">{roomName}</p>
      <table className="listing estimate-table">
        <thead>
          <tr>
            <th className="num">#</th>
            <th>Code</th>
            <th>Description</th>
            <th className="num">{locale === "fr" ? "Qté" : "Qty"}</th>
            <th className="num">Base</th>
            {/* `Frais généraux et profit`, the reference's own column head,
                abbreviated the way the reference abbreviates it. */}
            <th className="num">FG&amp;P</th>
            <th className="num">Total</th>
          </tr>
        </thead>
        <tbody>
          {TRADE_SECTIONS.filter((section) => bySection.has(section)).map((section) => (
            <Fragment key={section}>
              <tr className="estimate-section-row">
                <td colSpan={7}>{SECTION_LABEL[locale][section]}</td>
              </tr>
              {(bySection.get(section) ?? []).map((line) => {
                running += 1;
                const code = line.itemCode ?? line.removalItemCode ?? "—";
                const removal =
                  line.removalItemCode && line.itemCode
                    ? ` (E&R ${line.removalItemCode})`
                    : "";
                return (
                  <Fragment key={line.key}>
                    <tr>
                      <td className="num">{running}</td>
                      <td>{code}{removal}</td>
                      <td>
                        {/* The book's name in the document's language, keyed
                            by the code the line already carries — a
                            hand-edited name prints as the operator wrote it.
                            See `lineItemName`. */}
                        {lineItemName(line.itemCode ?? line.removalItemCode, locale, line.name)}
                        {line.calc && (
                          <div className="estimate-calc">CALC: {line.calc}</div>
                        )}
                        {line.note && (
                          <div className="estimate-calc estimate-note">{line.note}</div>
                        )}
                      </td>
                      <td className="num">{quantity(locale, line.quantity, line.unit)}</td>
                      <td className="num">{money(locale, line.baseCents)}</td>
                      <td className="num">{money(locale, line.opCents)}</td>
                      <td className="num">{money(locale, line.totalCents)}</td>
                    </tr>
                  </Fragment>
                );
              })}
            </Fragment>
          ))}
          <tr className="total">
            <td colSpan={6}>{`Total — ${roomName}`}</td>
            <td className="num">{money(locale, roomTotalCents)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/**
 * Which apartment a line prices — its own field where it has one, else the
 * unit its room was mapped to by the caller. A project-level line (no room)
 * never belongs to an apartment: débris and nettoyage final are the job's,
 * not one door's, which is why they print after the last unit.
 *
 * Exported because `ReportDocument` has to split the SAME way this table
 * groups: the estimate is cut into one block per apartment section and the
 * item numbers run 1..n once across the whole devis, so both sides must
 * agree on which line lands where. Two independent groupings would drift
 * the moment one of them learned about a case the other did not.
 */
export function lineApartment(
  line: AllocatedLine,
  unitOfRoom?: (roomScanId: string) => string | null | undefined,
): string | null {
  if (line.roomScanId === null) return null;
  const own = line.apartment?.trim();
  if (own) return own;
  return unitOfRoom?.(line.roomScanId)?.trim() || null;
}

/** The visible lines, split into one group per apartment in the order the
    document prints those apartments, plus the project-level remainder. Each
    group carries the index its first item number takes, so the `#` column
    stays a single 1..n run across every section of a split devis. */
export function groupLinesByApartment(
  lines: AllocatedLine[],
  order: string[],
  unitOfRoom?: (roomScanId: string) => string | null | undefined,
): { units: Map<string, { lines: AllocatedLine[]; startIndex: number }>; project: { lines: AllocatedLine[]; startIndex: number } } {
  const visible = lines.filter((l) => !l.removed);
  const units = new Map<string, { lines: AllocatedLine[]; startIndex: number }>();
  for (const id of order) units.set(id, { lines: [], startIndex: 0 });
  const project: AllocatedLine[] = [];
  for (const line of visible) {
    const id = lineApartment(line, unitOfRoom);
    const bucket = id === null ? undefined : units.get(id);
    if (bucket) bucket.lines.push(line);
    else project.push(line);
  }
  let running = 0;
  for (const id of order) {
    const bucket = units.get(id)!;
    bucket.startIndex = running;
    running += bucket.lines.length;
  }
  return { units, project: { lines: project, startIndex: running } };
}

export default function ReportEstimateTable({
  lines,
  totals,
  trailer,
  locale = "fr",
  startIndex = 0,
  subtotalUnit,
}: {
  /** Exactly what `allocateLines` produces — nothing recomputed here. Where
      the devis is split apartment by apartment this is one unit's slice of
      it; the arithmetic is the same either way, because every figure is
      read off the line rather than derived here. */
  lines: AllocatedLine[];
  /** The whole estimate's trailer. Omitted on a per-apartment block: the
      sommaire is the document's, printed once, after the last unit. */
  totals?: EstimateTotals | null;
  trailer: TrailerSettings;
  locale?: Locale;
  /** Where this block's `#` column starts, so a devis cut into apartment
      sections still numbers its items 1..n exactly once. */
  startIndex?: number;
  /** Prints « Sous-total — Appartement 103 » under this block. The figure is
      Σ of the block's own line totals — the same column the room totals above
      it add up, so a reader can check it by adding the rows they can see. */
  subtotalUnit?: string | null;
}) {
  const tl = TRAILER_LABEL[locale];
  const t = REPORT_STRINGS[locale];
  const visible = lines.filter((l) => !l.removed);

  const byRoom = new Map<string, { name: string; lines: AllocatedLine[] }>();
  const order: string[] = [];
  for (const line of visible) {
    const key = line.roomScanId ?? "__project__";
    if (!byRoom.has(key)) {
      byRoom.set(key, { name: line.roomScanId ? line.roomName : tl.frGeneraux, lines: [] });
      order.push(key);
    }
    byRoom.get(key)!.lines.push(line);
  }

  let counter = startIndex;
  const profitBasisLabel =
    trailer.profitBasis === "items_plus_generals" ? tl.profitBasisGP : tl.profitBasisItems;

  return (
    <div className="estimate">
      {order.map((key) => {
        const group = byRoom.get(key)!;
        const startIndex = counter;
        counter += group.lines.length;
        return (
          <RoomSection
            key={key}
            roomName={group.name}
            lines={group.lines}
            locale={locale}
            startIndex={startIndex}
          />
        );
      })}

      {/* **The unit's own bottom line, where the unit's pages end.** His
          instruction, 8 Sep 2026: the reader should reach the end of an
          apartment's section and know what that apartment costs, without
          adding four room totals in their head or waiting for a sommaire
          twelve pages later. Σ of this block's own `Total` column — the
          same figures printed directly above it, so it is checkable by the
          person it is meant to convince. */}
      {subtotalUnit && (
        <div className="estimate-subtotal">
          <table className="listing estimate-summary-table">
            <tbody>
              <tr className="total">
                <td>{t.unitSubtotal(subtotalUnit)}</td>
                <td className="num">
                  {money(locale, visible.reduce((sum, l) => sum + l.totalCents, 0))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* The grand sommaire — printed once for the document, after the last
          apartment and the project-level lines. A per-apartment block passes
          no totals and prints none: five trailers each claiming to be the
          VALEUR À NEUF is how a devis loses an argument it had won. */}
      {totals && (
      <div className="estimate-summary">
        <p className="marker marker-2">{locale === "fr" ? "Sommaire" : "Summary"}</p>
        <table className="listing estimate-summary-table">
          <tbody>
            <tr>
              <td>{tl.items}</td>
              <td className="num">{money(locale, totals.itemsCents)}</td>
            </tr>
            <tr>
              <td>{tl.generals(pct(locale, trailer.generalsPct))}</td>
              <td className="num">{money(locale, totals.generalsCents)}</td>
            </tr>
            <tr>
              <td>{tl.profit(pct(locale, trailer.profitPct), profitBasisLabel)}</td>
              <td className="num">{money(locale, totals.profitCents)}</td>
            </tr>
            <tr>
              <td>{tl.gst(pct(locale, trailer.gstPct))}</td>
              <td className="num">{money(locale, totals.gstCents)}</td>
            </tr>
            <tr>
              <td>{tl.qst(pct(locale, trailer.qstPct))}</td>
              <td className="num">{money(locale, totals.qstCents)}</td>
            </tr>
            <tr className="total">
              <td>{tl.total}</td>
              <td className="num">{money(locale, totals.totalCents)}</td>
            </tr>
          </tbody>
        </table>
        <p className="fineprint estimate-labor">
          {tl.labor} : {formatNumber(locale, totals.totalLaborHours, 2)} h
        </p>
        {/* The Québec restorer convention the conventions doc documents
            verbatim (§1) — a computed ACV column would be a claim an
            estimator working from a floor plan and a devis has no basis to
            make; the carrier's own adjuster is the one who applies it. */}
        <p className="fineprint">
          {locale === "fr"
            ? "La dépréciation est laissée à la discrétion de l'assureur et/ou de l'expert en sinistre. Aucune dépréciation n'est appliquée ci-dessus — Valeur à neuf = Sinistre net."
            : "Depreciation is left to the insurer's/adjuster's discretion. None is applied above — replacement cost value equals the net claim."}
        </p>
      </div>
      )}
    </div>
  );
}
