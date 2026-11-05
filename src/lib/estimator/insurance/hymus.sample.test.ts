import { writeFileSync } from "node:fs";
import { describe, it } from "vitest";
import { unitLabel } from "../catalog";
import { ESTIMATOR_STRINGS } from "./strings";
import { DAMAGE } from "./hymus.job";
import { buildHymusDevis } from "./hymus.devis";

/**
 * Worked sample — SDC H1 Phase 3, 122 boul. Hymus, Pointe-Claire (units 302,
 * 202, 102). Prints our devis, line by line with every CALC and NOTE, and the
 * per-unit comparison with the other firm's figures. The scope and the
 * operator edits are argued in hymus.devis.ts; the measurements in
 * hymus.job.ts.
 *
 * Asserts nothing; writes the devis. Run: npx vitest run hymus.sample
 *   → /tmp/hymus-devis.txt, /tmp/hymus-devis.json
 */

const t = ESTIMATOR_STRINGS.fr;

describe("worked sample — SDC H1 Phase 3, 122 boul. Hymus", () => {
  it("derives our devis from their measurements", () => {
    const { lines, totals } = buildHymusDevis();
    const money = (cents: number) =>
      (cents / 100).toLocaleString("fr-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const out: string[] = [];
    out.push("DEVIS — SDC H1 Phase 3, 122 boul. Hymus, Pointe-Claire (unités 302, 202, 102)");
    out.push("");
    let unit: string | null | undefined;
    let room: string | null = null;
    lines.forEach((l, i) => {
      if (l.apartment !== unit) {
        unit = l.apartment;
        out.push("");
        out.push(unit ? `=== Unité ${unit}` : "=== Frais généraux");
        room = null;
      }
      if (l.roomName !== room) {
        room = l.roomName;
        out.push(`--- ${room}`);
      }
      const code = l.itemCode ?? l.removalItemCode ?? "—";
      out.push(
        [
          String(i + 1).padEnd(4),
          l.tradeSection.padEnd(10),
          (code + (l.itemCode && l.removalItemCode ? ` +${l.removalItemCode}` : "")).padEnd(30),
          l.name.slice(0, 44).padEnd(45),
          `${t.qty(l.quantity)} ${unitLabel(l.unit, "fr")}`.padStart(14),
          money(l.baseCents).padStart(11),
          money(l.totalCents).padStart(11),
          l.origin === "manual" ? "  [opérateur]" : "",
        ].join(""),
      );
      out.push(`      CALC: ${l.calc}`);
      if (l.note) out.push(`      NOTE: ${l.note}`);
    });

    const byUnit = new Map<string, number>();
    for (const l of lines) {
      const k = l.apartment ?? "Frais généraux";
      byUnit.set(k, (byUnit.get(k) ?? 0) + l.totalCents);
    }
    out.push("");
    out.push("TOTAL PAR UNITÉ (taxes incluses)   ours        Polygon");
    const theirs: Record<string, number> = {
      "302": 229889,
      "202": 234511,
      "102": 345245,
      "Frais généraux": 122466 + 34658,
    };
    for (const [k, v] of byUnit) {
      out.push(`  ${k.padEnd(30)}${money(v).padStart(12)}${money(theirs[k] ?? 0).padStart(14)}`);
    }
    out.push("");
    out.push("SOMMAIRE");
    const rows: [string, number][] = [
      ["Ligne du total des articles", totals.itemsCents],
      ["Généraux 10 %", totals.generalsCents],
      ["Profit 5 % (articles)", totals.profitCents],
      ["TPS 5 %", totals.gstCents],
      ["TVQ 9,975 %", totals.qstCents],
      ["VALEUR À NEUF", totals.totalCents],
    ];
    rows.forEach(([k, v]) => out.push(`  ${k.padEnd(30)}${money(v).padStart(12)}`));
    out.push(`  Polygon (même chantier)        ${money(966769).padStart(12)}`);
    out.push(`  Main-d'œuvre incorporée        ${totals.totalLaborHours.toFixed(2).padStart(9)} h`);
    out.push(`  Zones sinistrées: ${Object.values(DAMAGE).flat().length}`);

    const text = out.join("\n");
    console.log("\n" + text + "\n");
    writeFileSync("/tmp/hymus-devis.txt", text);
    writeFileSync("/tmp/hymus-devis.json", JSON.stringify({ lines, totals }, null, 2));
  });
});
