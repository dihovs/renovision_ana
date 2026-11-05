import { writeFileSync } from "node:fs";
import { describe, it } from "vitest";
import { unitLabel } from "../catalog";
import { ESTIMATOR_STRINGS } from "./strings";
import { CLARK_PRICE_CENTS, buildClarkDevis } from "./clark.devis";

/**
 * Worked sample — SDC du 7027 Clark, unit 5. Prints our devis line by line
 * with every CALC and NOTE, and the per-room comparison with Lauresco's
 * 3674_7027C_R. Scope and edits argued in clark.devis.ts; measurements in
 * clark.job.ts.
 *
 * Asserts nothing; writes the devis. Run: npx vitest run clark.sample
 *   → /tmp/clark-devis.txt, /tmp/clark-devis.json
 */

const t = ESTIMATOR_STRINGS.fr;

describe("worked sample — SDC du 7027 Clark, unité 5", () => {
  it("derives our devis from their measurements", () => {
    const { lines, totals } = buildClarkDevis();
    const money = (cents: number) =>
      (cents / 100).toLocaleString("fr-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const out: string[] = ["DEVIS — SDC du 7027 Clark, unité 5 (7027 rue Clark, Montréal)", ""];
    let room: string | null = null;
    lines.forEach((l, i) => {
      if (l.roomName !== room) {
        room = l.roomName;
        out.push(`--- ${room}`);
      }
      const code = l.itemCode ?? l.removalItemCode ?? "—";
      out.push(
        [
          String(i + 1).padEnd(4),
          l.tradeSection.padEnd(10),
          (code + (l.itemCode && l.removalItemCode ? ` +${l.removalItemCode}` : "")).padEnd(28),
          l.name.slice(0, 46).padEnd(47),
          `${t.qty(l.quantity)} ${unitLabel(l.unit, "fr")}`.padStart(14),
          money(l.baseCents).padStart(10),
          money(l.totalCents).padStart(10),
          l.origin === "manual" ? "  [opérateur]" : "",
        ].join(""),
      );
      out.push(`      CALC: ${l.calc}`);
      if (l.note) out.push(`      NOTE: ${l.note}`);
    });
    const byRoom = new Map<string, number>();
    for (const l of lines) byRoom.set(l.roomName, (byRoom.get(l.roomName) ?? 0) + l.baseCents);
    out.push("", "ARTICLES PAR PIÈCE (avant FG&P et taxes)   ours       Lauresco");
    const theirs: Record<string, number> = { "Salle de bains": 106033, "Aire ouverte": 1375, "Frais généraux": 59060 };
    for (const [k, v] of byRoom) out.push(`  ${k.padEnd(30)}${money(v).padStart(12)}${money(theirs[k] ?? 0).padStart(13)}`);
    out.push("", "SOMMAIRE");
    const rows: [string, number][] = [
      ["Ligne du total des articles", totals.itemsCents],
      ["Généraux 10 %", totals.generalsCents],
      ["Profit 5 % (articles)", totals.profitCents],
      ["TPS 5 %", totals.gstCents],
      ["TVQ 9,975 %", totals.qstCents],
      ["VALEUR À NEUF", totals.totalCents],
    ];
    rows.forEach(([k, v]) => out.push(`  ${k.padEnd(30)}${money(v).padStart(12)}`));
    out.push(`  Lauresco (même chantier)       ${money(221064).padStart(12)}`);
    out.push(`  Prix fixé (Lauresco − 2,5 %)   ${money(CLARK_PRICE_CENTS).padStart(12)}`);
    out.push(`  Main-d'œuvre incorporée        ${totals.totalLaborHours.toFixed(2).padStart(9)} h`);
    const text = out.join("\n");
    console.log("\n" + text + "\n");
    writeFileSync("/tmp/clark-devis.txt", text);
    writeFileSync("/tmp/clark-devis.json", JSON.stringify({ lines, totals }, null, 2));
  });
});
