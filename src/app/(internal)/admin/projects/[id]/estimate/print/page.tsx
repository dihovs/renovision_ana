import { Fragment } from "react";
import { notFound } from "next/navigation";
import AdminNotice from "@/components/admin/AdminNotice";
import { isConfigured, MigrationPendingError } from "@/lib/crm/db";
import { getProject } from "@/lib/crm/projects";
import { getCompany } from "@/lib/crm/settings";
import { getOrCreateDraft, trailerSettings } from "@/lib/crm/insuranceEstimates";
import { GENERAL_CONDITIONS } from "@/lib/estimator/insurance/derive";
import { allocateLines, estimateTotals } from "@/lib/estimator/insurance/trailer";
import type { AllocatedLine } from "@/lib/estimator/insurance/types";

export const dynamic = "force-dynamic";

/**
 * The printed estimate — Xactimate's skeleton in Renovision's skin.
 *
 * The anatomy copies the reference claims exactly, because that structure
 * is what an adjuster's eye already knows how to read: room sections with
 * the seven-column line table and CALC citations, per-room totals, the
 * Frais généraux pseudo-room last, the Sommaire, and the two récaps. The
 * identity is Renovision's own — the reference's layout, never its brand.
 * Conventions: Docs/Estimator-Xactimate-Conventions.md.
 */

const SECTION_LABEL: Record<string, string> = {
  floor: "Plancher",
  ceiling: "Plafond",
  walls: "Murs",
  trim: "Boiseries",
  plumbing: "Plomberie",
  electrical: "Électricité",
  misc: "Divers",
};
const SECTION_ORDER = ["floor", "ceiling", "walls", "trim", "plumbing", "electrical", "misc"];

export default async function EstimatePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isConfigured) {
    return <AdminNotice title="No database connected yet">Set the database env vars first.</AdminNotice>;
  }
  const project = await getProject(id).catch((err) => {
    if (err instanceof MigrationPendingError) return null;
    throw err;
  });
  if (!project) notFound();

  let estimate;
  try {
    estimate = await getOrCreateDraft(project.id);
  } catch (err) {
    if (err instanceof MigrationPendingError) {
      return (
        <AdminNotice title="One migration to run">
          Apply <code>0042_insurance_estimates.sql</code> first.
        </AdminNotice>
      );
    }
    throw err;
  }
  const company = await getCompany().catch(() => null);

  const settings = trailerSettings(estimate);
  const allocated = allocateLines(
    estimate.lines.filter((line) => !line.removed),
    settings,
  );
  const totals = estimateTotals(allocated);

  // Group by room in first-appearance order, general conditions last, trade
  // sections in the reference's fixed order, lines numbered continuously.
  const roomOrder: string[] = [];
  const byRoom = new Map<string, AllocatedLine[]>();
  for (const line of allocated) {
    const room = line.roomName || GENERAL_CONDITIONS;
    if (!byRoom.has(room)) {
      byRoom.set(room, []);
      roomOrder.push(room);
    }
    byRoom.get(room)!.push(line);
  }
  const rooms = roomOrder.filter((room) => room !== GENERAL_CONDITIONS);
  if (byRoom.has(GENERAL_CONDITIONS)) rooms.push(GENERAL_CONDITIONS);

  let lineNumber = 0;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-3xl bg-white p-6 text-[13px] leading-snug text-charcoal print:p-0">
      <style>{`@media print { nav, header, footer.site { display: none !important; } @page { margin: 14mm; } }`}</style>

      {/* Letterhead — ours */}
      <header className="border-b-2 border-brand-blue pb-3">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="font-heading text-xl font-bold text-brand-blue">
              {company?.tradeName || "Renovision AnA"}
            </div>
            <div className="text-charcoal/60">
              {[company?.street1, company?.city, company?.province, company?.postalCode]
                .filter(Boolean)
                .join(", ")}
            </div>
            <div className="text-charcoal/60">
              {[company?.phone, company?.email].filter(Boolean).join(" · ")}
            </div>
          </div>
          <div className="text-right text-charcoal/60">
            {company?.rbqLicence && <div>RBQ : {company.rbqLicence}</div>}
            {company?.gstNumber && <div>TPS : {company.gstNumber}</div>}
            {company?.qstNumber && <div>TVQ : {company.qstNumber}</div>}
          </div>
        </div>
      </header>

      <div className="mt-4 flex items-baseline justify-between">
        <div>
          <h1 className="font-heading text-lg font-bold">{estimate.title}</h1>
          <div className="text-charcoal/60">
            {project.name}
            {project.client?.name ? ` — ${project.client.name}` : ""}
          </div>
        </div>
        <div className="text-right text-charcoal/60">
          <div>Date : {today}</div>
          <div className="uppercase">{estimate.status === "draft" ? "Brouillon" : "Final"}</div>
        </div>
      </div>

      {/* Rooms */}
      {rooms.map((room) => {
        const roomLines = [...byRoom.get(room)!].sort(
          (a, b) => SECTION_ORDER.indexOf(a.tradeSection) - SECTION_ORDER.indexOf(b.tradeSection),
        );
        const roomTax = roomLines.reduce((s, l) => s + l.taxCents, 0);
        const roomOp = roomLines.reduce((s, l) => s + l.opCents, 0);
        const roomTotal = roomLines.reduce((s, l) => s + l.totalCents, 0);
        let currentSection = "";

        return (
          <section key={room} className="mt-5 break-inside-avoid-page">
            <h2 className="border-b border-charcoal/80 pb-0.5 font-heading text-sm font-bold">
              {room}
            </h2>
            <table className="mt-1 w-full border-collapse">
              <thead>
                <tr className="text-left text-[10px] font-bold uppercase tracking-wide text-charcoal/50">
                  <th className="py-1 pr-2 font-bold">Description</th>
                  <th className="w-20 py-1 pr-2 text-right font-bold">Qté</th>
                  <th className="w-16 py-1 pr-2 text-right font-bold">Enlev</th>
                  <th className="w-16 py-1 pr-2 text-right font-bold">Remplac</th>
                  <th className="w-16 py-1 pr-2 text-right font-bold">Taxe</th>
                  <th className="w-20 py-1 pr-2 text-right font-bold">
                    Frais gén. et profit
                  </th>
                  <th className="w-20 py-1 text-right font-bold">Total</th>
                </tr>
              </thead>
              <tbody>
                {roomLines.map((line) => {
                  lineNumber += 1;
                  const sectionHeader =
                    line.tradeSection !== currentSection ? (
                      <tr key={`${line.key}-section`}>
                        <td
                          colSpan={7}
                          className="pt-2 text-[11px] font-bold underline decoration-charcoal/40"
                        >
                          {SECTION_LABEL[line.tradeSection] ?? line.tradeSection} :
                        </td>
                      </tr>
                    ) : null;
                  currentSection = line.tradeSection;
                  const memo = line.activity === "memo";
                  return (
                    <Fragment key={line.key}>
                      {sectionHeader}
                      <tr className="align-top">
                        <td className="py-0.5 pr-2">
                          {lineNumber}. {line.name}
                          {line.issues.includes("no_item") && (
                            <span className="ml-1 font-bold text-amber-700">[à tarifer]</span>
                          )}
                          {line.calc && (
                            <div className="text-[10px] text-charcoal/45">{line.calc}</div>
                          )}
                          {line.note && (
                            <div className="text-[10px] italic text-charcoal/45">{line.note}</div>
                          )}
                        </td>
                        <td className="py-0.5 pr-2 text-right tabular-nums">
                          {line.quantity.toFixed(2)} {unitCode(line.unit)}
                        </td>
                        <td className="py-0.5 pr-2 text-right tabular-nums">
                          {memo ? "" : rate(line.removeRateCents)}
                        </td>
                        <td className="py-0.5 pr-2 text-right tabular-nums">
                          {memo ? "" : rate(line.replaceRateCents)}
                        </td>
                        <td className="py-0.5 pr-2 text-right tabular-nums">
                          {memo ? "" : cents2(line.taxCents)}
                        </td>
                        <td className="py-0.5 pr-2 text-right tabular-nums">
                          {memo ? "" : cents2(line.opCents)}
                        </td>
                        <td className="py-0.5 text-right tabular-nums">
                          {memo ? "0,00" : cents2(line.totalCents)}
                        </td>
                      </tr>
                    </Fragment>
                  );
                })}
                <tr className="border-t border-charcoal/60 text-[12px] font-bold">
                  <td className="py-1 pr-2">Totaux : {room}</td>
                  <td colSpan={3} />
                  <td className="py-1 pr-2 text-right tabular-nums">{cents2(roomTax)}</td>
                  <td className="py-1 pr-2 text-right tabular-nums">{cents2(roomOp)}</td>
                  <td className="py-1 text-right tabular-nums">{cents2(roomTotal)}</td>
                </tr>
              </tbody>
            </table>
          </section>
        );
      })}

      {/* Sommaire */}
      <section className="mt-8 break-inside-avoid-page">
        <h2 className="text-center font-heading text-sm font-bold">Sommaire</h2>
        <dl className="mx-auto mt-2 max-w-md space-y-0.5">
          <Row label="Ligne du total des articles" value={totals.itemsCents} />
          <Row
            label={`Généraux (${(settings.generalsPct * 100).toFixed(0)}%)`}
            value={totals.generalsCents}
          />
          <Row
            label={`Profit (${(settings.profitPct * 100).toFixed(0)}%)`}
            value={totals.profitCents}
          />
          <Row label="TPS (5%)" value={totals.gstCents} />
          <Row label="TVQ (9,975%)" value={totals.qstCents} />
          <div className="border-t border-charcoal/60 pt-0.5">
            <Row label="Valeur à neuf" value={totals.totalCents} bold />
            <Row label="Sinistre net" value={totals.totalCents} bold />
          </div>
        </dl>
        <p className="mx-auto mt-4 max-w-md text-[10px] text-charcoal/50">
          La dépréciation au niveau des composantes relatives à la présente estimation est
          laissée à la discrétion de l&apos;assureur et/ou l&apos;expert en sinistre étant
          l&apos;administrateur de la réclamation.
        </p>
        <div className="mx-auto mt-10 max-w-md border-t border-charcoal/40 pt-1 text-center text-[11px] text-charcoal/60">
          {company?.tradeName || "Renovision AnA"}
        </div>
      </section>

      {/* Récapitulatif par pièce */}
      <section className="mt-8 break-inside-avoid-page">
        <h2 className="text-center font-heading text-sm font-bold">Récapitulatif par pièce</h2>
        <table className="mx-auto mt-2 w-full max-w-md">
          <tbody>
            {rooms.map((room) => {
              const roomBase = byRoom
                .get(room)!
                .reduce((s, l) => s + l.baseCents, 0);
              const pct = totals.itemsCents > 0 ? (roomBase / totals.itemsCents) * 100 : 0;
              return (
                <tr key={room}>
                  <td className="py-0.5">{room}</td>
                  <td className="py-0.5 text-right tabular-nums">{cents2(roomBase)}</td>
                  <td className="w-16 py-0.5 text-right tabular-nums">{pct.toFixed(2)}%</td>
                </tr>
              );
            })}
            <tr className="border-t border-charcoal/60 font-bold">
              <td className="py-1">Total</td>
              <td className="py-1 text-right tabular-nums">{cents2(totals.itemsCents)}</td>
              <td className="py-1 text-right tabular-nums">100,00%</td>
            </tr>
          </tbody>
        </table>
      </section>

      <footer className="mt-8 flex justify-between border-t border-black/10 pt-2 text-[10px] text-charcoal/40">
        <span>
          {project.name} — {estimate.title}
        </span>
        <span>{today}</span>
      </footer>
    </div>
  );

  function rate(value: number | null): string {
    return value === null ? "0,00" : cents2(value);
  }
}

/** French-format cents: 1 234,56 — the document reads in the market's own
    conventions, decimal comma and space thousands. */
function cents2(cents: number): string {
  return new Intl.NumberFormat("fr-CA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function unitCode(unit: string): string {
  switch (unit) {
    case "sq ft":
      return "P2";
    case "linear ft":
      return "PL";
    case "each":
      return "CH";
    case "hour":
      return "HR";
    case "day":
      return "JR";
    default:
      return unit.toUpperCase().slice(0, 4);
  }
}

function Row({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between ${bold ? "font-bold" : ""}`}>
      <dt>{label}</dt>
      <dd className="tabular-nums">{cents2(value)} $</dd>
    </div>
  );
}
