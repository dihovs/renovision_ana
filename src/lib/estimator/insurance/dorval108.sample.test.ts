import { writeFileSync } from "node:fs";
import { describe, it } from "vitest";
import { unitLabel } from "../catalog";
import { ESTIMATOR_STRINGS } from "./strings";
import { DORVAL108_TARGET_CENTS, DORVAL108_THEIRS_CENTS, buildDorval108Devis } from "./dorval108.devis";

/**
 * Worked sample — SDC Faubourg Dorval, app. 108. Prints our devis with every
 * CALC and NOTE against Restauration CT's total, and writes a printable HTML.
 * Asserts nothing. Run: npx vitest run dorval108.sample
 *   → /tmp/dorval108-devis.txt, /tmp/dorval108-devis.html
 */

const t = ESTIMATOR_STRINGS.fr;
const money = (cents: number) =>
  (cents / 100).toLocaleString("fr-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " $";
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

describe("worked sample — SDC Faubourg Dorval, app. 108", () => {
  it("prices their scope our way", () => {
    const { lines, totals } = buildDorval108Devis();
    const out: string[] = ["DEVIS — SDC Faubourg Dorval, app. 108 (205 av. Dorval)", ""];
    lines.forEach((l, i) => {
      out.push(
        `${String(i + 1).padEnd(4)}${(l.itemCode ?? "PROVISION").padEnd(16)}${l.name.slice(0, 50).padEnd(52)}` +
          `${`${t.qty(l.quantity)} ${unitLabel(l.unit, "fr")}`.padStart(12)}${money(l.baseCents).padStart(13)}${money(l.totalCents).padStart(13)}`,
      );
      out.push(`      CALC: ${l.calc}`);
      if (l.note) out.push(`      NOTE: ${l.note}`);
    });
    const rows: [string, number][] = [
      ["Total des articles", totals.itemsCents],
      ["Frais généraux 10 %", totals.generalsCents],
      ["Profit 5 %", totals.profitCents],
      ["TPS 5 %", totals.gstCents],
      ["TVQ 9,975 %", totals.qstCents],
      ["TOTAL", totals.totalCents],
    ];
    out.push("", "SOMMAIRE");
    rows.forEach(([k, v]) => out.push(`  ${k.padEnd(28)}${money(v).padStart(14)}`));
    out.push(`  ${"Restauration CT".padEnd(28)}${money(DORVAL108_THEIRS_CENTS).padStart(14)}`);
    out.push(`  ${"Cible (−5 %)".padEnd(28)}${money(DORVAL108_TARGET_CENTS).padStart(14)}`);
    out.push(`  Écart vs CT: ${(((totals.totalCents - DORVAL108_THEIRS_CENTS) / DORVAL108_THEIRS_CENTS) * 100).toFixed(1)} %`);
    const text = out.join("\n");
    console.log("\n" + text + "\n");
    writeFileSync("/tmp/dorval108-devis.txt", text);

    const body = lines
      .map(
        (l, i) => `<tr><td>${i + 1}</td><td><b>${esc(l.name)}</b><div class="c">${esc(l.calc ?? "")}</div>${
          l.note ? `<div class="n">${esc(l.note)}</div>` : ""
        }</td><td class="r">${t.qty(l.quantity)} ${unitLabel(l.unit, "fr")}</td><td class="r">${money(
          l.replaceRateCents ?? 0,
        )}</td><td class="r">${money(l.baseCents)}</td></tr>`,
      )
      .join("");
    const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Devis — SDC Faubourg Dorval, app. 108</title>
<style>
@page{size:letter;margin:1.3cm}body{font:10pt/1.35 -apple-system,Helvetica,Arial,sans-serif;color:#1d2433}
.h{display:flex;justify-content:space-between;border-bottom:3px solid #1f5fa8;padding-bottom:10px;margin-bottom:14px}
.h b{font-size:15pt;color:#1f5fa8}.h div{font-size:9pt}
h1{font-size:14pt;margin:0 0 4px}.m{font-size:9pt;color:#555;margin-bottom:12px}
table{width:100%;border-collapse:collapse}th{background:#1f5fa8;color:#fff;text-align:left;padding:5px;font-size:9pt}
td{border-bottom:1px solid #ddd;padding:3px 5px;vertical-align:top}.r{text-align:right;white-space:nowrap}
.c{font-size:8.5pt;color:#555}.n{font-size:8.5pt;color:#8a5a00}
.s{width:46%;margin:14px 0 0 auto}.s td{border:none;padding:3px 5px}.s tr:last-child td{font-weight:700;font-size:12pt;border-top:2px solid #1d2433}
.x{margin-top:18px;font-size:8.5pt;color:#555}
</style></head><body>
<div class="h"><div><b>Renovision AnA inc.</b><div>Laval (Québec) · 579-999-5979 · info@renovisionana.ca · renovisionana.ca</div></div>
<div class="r">TPS 778981019 RT0001<br>TVQ 1230209096 IC0001<br>Date : 2026-11-09</div></div>
<h1>Devis — Réparations, appartement 108</h1>
<div class="m">Client : SDC Faubourg Dorval · 205 av. Dorval, app. 108, Dorval (Québec) H9S 3H2<br>
Fermeture de l'ouverture faite lors de la réparation de plomberie : isolant coupe-feu, plâtre, céramique, coupe-feu au passage du tuyau et trappe d'accès.</div>
<table><tr><th>#</th><th>Description</th><th class="r">Qté</th><th class="r">Prix unit.</th><th class="r">Montant</th></tr>${body}</table>
<table class="s">${rows.map(([k, v]) => `<tr><td>${k}</td><td class="r">${money(v)}</td></tr>`).join("")}</table>
<div class="x">Exclusions : peinture (non demandée; apprêt et deux couches sur la surface réparée en option, 64,00 $ avant frais et taxes), travaux de plomberie, agencement exact de la céramique existante. Valide 30 jours.</div>
</body></html>`;
    writeFileSync("/tmp/dorval108-devis.html", html);
  });
});
