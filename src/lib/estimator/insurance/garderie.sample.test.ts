import { writeFileSync } from "node:fs";
import { describe, it } from "vitest";
import { unitLabel } from "../catalog";
import { ESTIMATOR_STRINGS } from "./strings";
import { buildGarderieDevis } from "./garderie.devis";
import { ROOM_SHAPES, roomFigures, stairwellSqFt } from "./garderie.job";

const painted = (key: string) => Math.round(roomFigures(ROOM_SHAPES.find((r) => r.key === key)!).paintSqFt);
const WALLS = { entrance: painted("entrance"), stair: Math.round(stairwellSqFt()), vestibule: painted("vestibule"), kitchen: painted("kitchen") };
import type { AllocatedLine } from "./types";

/**
 * Worked sample — daycare common areas repainted grey (entrance, stairwell,
 * Vestibule 200) with the kitchen A208 as an option. Prints every CALC and
 * NOTE and writes a printable HTML. Asserts nothing.
 * Run: npx vitest run garderie.sample
 *   → /tmp/garderie-devis.txt, /tmp/garderie-devis.html
 * Client and address come from env (GARDERIE_CLIENT, GARDERIE_ADDRESS) so no
 * client data lands in the repo.
 */

const t = ESTIMATOR_STRINGS.fr;
const money = (cents: number) =>
  (cents / 100).toLocaleString("fr-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " $";
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const pi2 = (n: number) => n.toLocaleString("fr-CA") + " pi²";

type Totals = ReturnType<typeof buildGarderieDevis>["base"]["totals"];
const rowsOf = (x: Totals): [string, number][] => [
  ["Total des articles", x.itemsCents],
  ["Frais généraux 10 %", x.generalsCents],
  ["Profit 5 %", x.profitCents],
  ["TPS 5 %", x.gstCents],
  ["TVQ 9,975 %", x.qstCents],
  ["TOTAL", x.totalCents],
];

describe("worked sample — daycare common areas, grey", () => {
  it("prices the repaint", () => {
    const { base, kitchen } = buildGarderieDevis();
    const out: string[] = ["DEVIS — Garderie : hall d'entrée, cage d'escalier, vestibule 200 (+ option cuisine)", ""];
    const print = (lines: AllocatedLine[]) =>
      lines.forEach((l, i) => {
        out.push(
          `${String(i + 1).padEnd(4)}${(l.itemCode ?? "PROVISION").padEnd(18)}${l.name.slice(0, 50).padEnd(52)}` +
            `${`${t.qty(l.quantity)} ${unitLabel(l.unit, "fr")}`.padStart(12)}${money(l.baseCents).padStart(13)}${money(l.totalCents).padStart(13)}`,
        );
        out.push(`      [${l.roomName}] CALC: ${l.calc}`);
        if (l.note) out.push(`      NOTE: ${l.note}`);
      });
    print(base.lines);
    out.push("", "SOMMAIRE — travaux demandés");
    rowsOf(base.totals).forEach(([k, v]) => out.push(`  ${k.padEnd(28)}${money(v).padStart(14)}`));
    out.push("", "OPTION — cuisine A208");
    print(kitchen.lines);
    rowsOf(kitchen.totals).forEach(([k, v]) => out.push(`  ${k.padEnd(28)}${money(v).padStart(14)}`));
    out.push("", `  ${"Avec la cuisine".padEnd(28)}${money(base.totals.totalCents + kitchen.totals.totalCents).padStart(14)}`);
    const sqft = WALLS.entrance + WALLS.stair + WALLS.vestibule;
    out.push(`  Murs peints : ${sqft} pi² (+ ${WALLS.kitchen} cuisine) — ${money(Math.round(base.totals.itemsCents / sqft))}/pi² avant frais`);
    const hours = (ls: AllocatedLine[]) => ls.reduce((h, l) => h + l.laborHours, 0);
    out.push(`  Main-d'œuvre : ${hours(base.lines).toFixed(1)} h (+ ${hours(kitchen.lines).toFixed(1)} h cuisine)`);
    const text = out.join("\n");
    console.log("\n" + text + "\n");
    writeFileSync("/tmp/garderie-devis.txt", text);

    const client = process.env.GARDERIE_CLIENT ?? "—";
    const address = process.env.GARDERIE_ADDRESS ?? "—";
    const table = (lines: AllocatedLine[]) => {
      let zone = "";
      let n = 0;
      return lines
        .map((l) => {
          const head = l.roomName !== zone ? `<tr class="z"><td colspan="5">${esc((zone = l.roomName))}</td></tr>` : "";
          n += 1;
          return `${head}<tr><td>${n}</td><td><b>${esc(l.name)}</b><div class="c">${esc(l.calc ?? "")}</div>${
            l.note ? `<div class="n">${esc(l.note)}</div>` : ""
          }</td><td class="r">${t.qty(l.quantity)} ${unitLabel(l.unit, "fr")}</td><td class="r">${money(
            l.replaceRateCents ?? 0,
          )}</td><td class="r">${money(l.baseCents)}</td></tr>`;
        })
        .join("");
    };
    const summary = (x: Totals) =>
      `<table class="s">${rowsOf(x).map(([k, v]) => `<tr><td>${k}</td><td class="r">${money(v)}</td></tr>`).join("")}</table>`;
    const head = `<tr><th>#</th><th>Description</th><th class="r">Qté</th><th class="r">Prix unit.</th><th class="r">Montant</th></tr>`;
    const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Devis — Peinture des aires communes</title>
<style>
@page{size:letter;margin:1.3cm}body{font:10pt/1.35 -apple-system,Helvetica,Arial,sans-serif;color:#1d2433}
.h{display:flex;justify-content:space-between;border-bottom:3px solid #1f5fa8;padding-bottom:10px;margin-bottom:14px}
.h b{font-size:15pt;color:#1f5fa8}.h div{font-size:9pt}
h1{font-size:14pt;margin:0 0 4px}h2{font-size:12pt;margin:20px 0 6px;color:#1f5fa8}.m{font-size:9pt;color:#555;margin-bottom:12px}
table{width:100%;border-collapse:collapse}th{background:#1f5fa8;color:#fff;text-align:left;padding:5px;font-size:9pt}
td{border-bottom:1px solid #ddd;padding:3px 5px;vertical-align:top}.r{text-align:right;white-space:nowrap}
tr.z td{background:#eef3fa;font-weight:700;border-bottom:1px solid #c9d6ea;padding-top:6px}
.c{font-size:8.5pt;color:#555}.n{font-size:8.5pt;color:#8a5a00}
.s{width:46%;margin:12px 0 0 auto;break-inside:avoid}.s td{border:none;padding:3px 5px}.s tr:last-child td{font-weight:700;font-size:12pt;border-top:2px solid #1d2433}
.g{width:46%;margin:16px 0 0 auto;border:2px solid #1f5fa8;break-inside:avoid}.g td{border:none;padding:6px 8px;font-weight:700}
.opt{break-inside:avoid}
.x{margin-top:18px;font-size:8.5pt;color:#555}.x p{margin:4px 0}
</style></head><body>
<div class="h"><div><b>Renovision AnA inc.</b><div>Laval (Québec) · 579-999-5979 · info@renovisionana.ca · renovisionana.ca</div></div>
<div class="r">TPS 778981019 RT0001<br>TVQ 1230209096 IC0001<br>Date : 2026-11-14</div></div>
<h1>Devis — Peinture des aires communes de la garderie</h1>
<div class="m">Client : ${esc(client)} · ${esc(address)}<br>
Nouvelle couleur grise, deux couches, sur les murs du hall d'entrée, de la cage d'escalier et du vestibule 200 à l'étage, avec les petites réparations du bas des murs. La cuisine A208 est proposée en option.</div>
<table>${head}${table(base.lines)}</table>
${summary(base.totals)}
<div class="opt"><h2>Option — Cuisine A208</h2>
<table>${head}${table(kitchen.lines)}</table>
${summary(kitchen.totals)}</div>
<table class="g"><tr><td>Total avec la cuisine</td><td class="r">${money(base.totals.totalCents + kitchen.totals.totalCents)}</td></tr></table>
<div class="x">
<p><b>Quantités</b> : relevées sur notre dessin des plans fournis, ajusté aux superficies imprimées (murs : ${pi2(WALLS.entrance)} hall, ${pi2(WALLS.stair)} escalier, ${pi2(WALLS.vestibule)} vestibule, ${pi2(WALLS.kitchen)} cuisine). Elles seront confirmées au mesurage sur place; le prix suit les quantités réelles.</p>
<p><b>Comprend</b> : la peinture (gris pâle à moyen, choisi par le client), la protection, les petites réparations du bas des murs et le nettoyage chaque jour.</p>
<p><b>Exclus</b> : plafonds et plafond suspendu, portes et cadres, rampes et garde-corps, marches, réparations majeures du placoplâtre (125 $ par réparation si on en trouve), gris foncé (supplément de 0,95 $/pi²). Valide 30 jours.</p>
</div>
</body></html>`;
    writeFileSync("/tmp/garderie-devis.html", html);
  });
});
