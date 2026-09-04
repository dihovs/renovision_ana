import { Fragment } from "react";
import { notFound } from "next/navigation";
import AdminNotice from "@/components/admin/AdminNotice";
import { isConfigured, MigrationPendingError } from "@/lib/crm/db";
import { getProject } from "@/lib/crm/projects";
import { getCompany } from "@/lib/crm/settings";
import { listRoomScans } from "@/lib/crm/roomScans";
import { listProjectAffectedAreas } from "@/lib/crm/affectedAreas";
import { listProjectObjects } from "@/lib/crm/roomObjects";
import { areaColor, planAreas } from "@/lib/crm/areaShapes";
import type { ScanGeometry } from "@/lib/roomScan";
import {
  savedFloorAreaSquareMeters,
  savedPerimeterMeters,
  savedWallAreaSquareMeters,
  type SavedScan,
} from "@/lib/roomScan";
import FloorPlan from "@/components/admin/FloorPlan";
import ReportStoreyPlan from "@/components/admin/ReportStoreyPlan";
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

  // **The drawing belongs in the estimate, not only in the report.** The
  // reference claims put a thumbnail beside every room's quantities and a
  // full storey plan at the back, and for a reason an adjuster feels
  // immediately: a line that says 44 sq ft of tile is a claim, and a
  // drawing with that area shaded on it is evidence. Both components are
  // the REPORT'S — `FloorPlan` and `ReportStoreyPlan` — because a second
  // renderer is a second thing to drift, and a plan that disagreed between
  // the two documents would be worse than no plan in this one.
  const [scans, allAreas, allObjects] = await Promise.all([
    listRoomScans(project.id).catch(() => []),
    listProjectAffectedAreas(project.id).catch(() => []),
    listProjectObjects(project.id).catch(() => []),
  ]);

  const planObjectsFor = (scanId: string) =>
    allObjects
      .filter((object) => object.roomScanId === scanId)
      .map((object) => ({
        id: object.id,
        kind: object.kind,
        name: object.name,
        x: object.x,
        y: object.y,
        rotation: object.rotation,
        widthM: object.width,
        depthM: object.depth,
      }));

  // Plan-space areas only — the floor and the ceiling, which share the
  // plan's metres. A wall area's polygon lives in its wall's own face space
  // and would be drawn as nonsense on a plan.
  const planAreasFor = (scanId: string) =>
    planAreas(allAreas)
      .filter((area) => area.room_scan_id === scanId && area.polygon.length >= 3)
      .map((area) => ({ id: area.id, polygon: area.polygon, color: areaColor(area) }));

  const scanById = new Map(scans.map((scan) => [scan.id, scan]));

  const storeyRooms = scans.map((scan) => ({
    id: scan.id,
    name: scan.name,
    geometry: scan.geometry as unknown as ScanGeometry,
    floorAreaSqm: savedFloorAreaSquareMeters(scan as unknown as SavedScan),
    planX: scan.plan_x === null ? null : Number(scan.plan_x),
    planY: scan.plan_y === null ? null : Number(scan.plan_y),
    areas: planAreasFor(scan.id),
    objects: planObjectsFor(scan.id),
  }));

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

        // The room's own scan, when this group is a real room rather than
        // the general-conditions pseudo-room.
        const scanId = roomLines.find((line) => line.roomScanId)?.roomScanId ?? null;
        const scan = scanId ? scanById.get(scanId) : undefined;
        const saved = scan ? (scan as unknown as SavedScan) : null;
        const wallArea = saved ? savedWallAreaSquareMeters(saved) : null;

        return (
          <section key={room} className="mt-5 break-inside-avoid-page">
            <h2 className="flex items-baseline justify-between border-b border-charcoal/80 pb-0.5 font-heading text-sm font-bold">
              <span>{room}</span>
              {saved && (
                <span className="text-[10px] font-normal text-charcoal/50">
                  Hauteur du plafond : {sqftLabel(saved.ceiling_height_m, "m")}
                </span>
              )}
            </h2>

            {/* The room header of the reference claims: the drawing, and the
                measured quantities every line below is priced from. */}
            {scan && saved && (
              <div className="mt-2 flex flex-wrap items-start gap-4 break-inside-avoid-page">
                <div className="w-40 shrink-0">
                  <FloorPlan
                    result={scan.geometry as unknown as ScanGeometry}
                    name={scan.name}
                    variant="thumb"
                    locale="fr"
                    objects={planObjectsFor(scan.id)}
                    areas={planAreasFor(scan.id)}
                  />
                </div>
                <dl className="grid flex-1 grid-cols-2 gap-x-6 gap-y-0.5 text-[11px] tabular-nums sm:grid-cols-3">
                  <Measure label="pi² murs" value={sqft(wallArea?.gross ?? 0)} />
                  <Measure label="pi² plafond" value={sqft(savedFloorAreaSquareMeters(saved))} />
                  <Measure
                    label="pi² murs, plafond"
                    value={sqft((wallArea?.gross ?? 0) + savedFloorAreaSquareMeters(saved))}
                  />
                  <Measure label="pi² plancher" value={sqft(savedFloorAreaSquareMeters(saved))} />
                  <Measure label="vg² rev. sol" value={sqyd(savedFloorAreaSquareMeters(saved))} />
                  <Measure label="pi lin. pér." value={linft(savedPerimeterMeters(saved))} />
                </dl>
              </div>
            )}
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

      {/* The storey, at the back, exactly where the reference puts it. */}
      {storeyRooms.length > 0 && (
        <section className="mt-8 break-before-page">
          <h2 className="text-center font-heading text-sm font-bold">Plan de l&apos;étage</h2>
          <div className="mt-2">
            <ReportStoreyPlan
              rooms={storeyRooms}
              locale="fr"
              note="Disposition assemblée à partir des pièces mesurées."
            />
          </div>
        </section>
      )}

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

/** Metric in, the document's imperial out — the same conversions the
    estimate lines are priced from, so the header block and the lines below
    it can never quote different numbers. */
const SQM_PER_SQFT = 0.09290304;
const M_PER_FT = 0.3048;
function sqft(sqm: number): string {
  return frNumber(sqm / SQM_PER_SQFT);
}
function sqyd(sqm: number): string {
  return frNumber(sqm / (SQM_PER_SQFT * 9));
}
function linft(m: number): string {
  return frNumber(m / M_PER_FT);
}
function frNumber(value: number): string {
  return new Intl.NumberFormat("fr-CA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
function sqftLabel(value: number, unit: string): string {
  return `${frNumber(value)} ${unit}`;
}

function Measure({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dd className="font-semibold">{value}</dd>
      <dt className="text-charcoal/50">{label}</dt>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between ${bold ? "font-bold" : ""}`}>
      <dt>{label}</dt>
      <dd className="tabular-nums">{cents2(value)} $</dd>
    </div>
  );
}
