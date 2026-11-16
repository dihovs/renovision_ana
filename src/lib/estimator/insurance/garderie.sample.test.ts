import { writeFileSync } from "node:fs";
import { describe, it } from "vitest";
import type { Locale } from "@/i18n/translations";
import { unitLabel } from "../catalog";
import { ESTIMATOR_STRINGS } from "./strings";
import { buildGarderieDevis, clientPaintNeeds, type GarderieSupply } from "./garderie.devis";
import { ROOM_SHAPES, roomFigures, stairwellSqFt } from "./garderie.job";
import type { AllocatedLine } from "./types";

/**
 * Worked sample — daycare common areas repainted grey (entrance, stairwell,
 * Vestibule 200) with the kitchen A208 as an option. Prints every CALC and
 * NOTE and writes a printable HTML, in French and in English. Asserts nothing.
 * Run: npx vitest run garderie.sample
 *   → /tmp/garderie-devis.{txt,html} (fr), /tmp/garderie-devis.en.{txt,html}
 *   and the version where she buys the paint: /tmp/garderie-devis.labour{,.en}.{txt,html}
 * Client and address come from env (GARDERIE_CLIENT, GARDERIE_ADDRESS) so no
 * client data lands in the repo.
 */

const painted = (key: string) => Math.round(roomFigures(ROOM_SHAPES.find((r) => r.key === key)!).paintSqFt);
const WALLS = { entrance: painted("entrance"), stair: Math.round(stairwellSqFt()), vestibule: painted("vestibule"), kitchen: painted("kitchen") };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const NEED = clientPaintNeeds();

/** The document's own words, per language. */
const COPY = {
  fr: {
    money: (cents: number) =>
      (cents / 100).toLocaleString("fr-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " $",
    area: (n: number) => n.toLocaleString("fr-CA") + " pi²",
    title: "Devis — Peinture des aires communes",
    heading: "Devis — Peinture des aires communes de la garderie",
    textTitle: "DEVIS — Garderie : hall d'entrée, cage d'escalier, vestibule 200 (+ option cuisine)",
    city: "Laval (Québec)",
    gst: "TPS",
    qst: "TVQ",
    date: "Date : 2026-11-14",
    client: "Client :",
    intro:
      "Nouvelle couleur grise, deux couches, sur les murs du hall d'entrée, de la cage d'escalier et du vestibule 200 à l'étage, avec les petites réparations du bas des murs. La cuisine A208 est proposée en option.",
    labourTag: " — peinture fournie par le client",
    clientMaterials: `<b>Vous fournissez la peinture et l'apprêt; nous fournissons tout le reste.</b>
<ul><li><b>Par vous</b> : environ ${NEED.base.paintGal} gallons (3,78 L) du gris de votre choix pour deux couches et ${NEED.base.primerGal} gallon d'apprêt (cuisine, si retenue : ${NEED.kitchen.paintGal} gallons de plus en fini lavable et ${NEED.kitchen.primerGal} d'apprêt). Même code de couleur et même fini partout, sur place au début des travaux.</li>
<li><b>Par nous</b> : le plâtre et le papier sablé pour les réparations, et toute la protection : toiles, plastique, papier et ruban de masquage.</li></ul>`,
    materials: `<b>Tous les matériaux sont fournis par Renovision AnA et compris dans le prix — vous n'avez rien à acheter.</b>
<ul><li><b>Peinture</b> : le gris pâle à moyen de votre choix, deux couches (fini lavable dans la cuisine, si retenue).</li>
<li><b>Plâtre</b> : composé à joints pour les réparations, papier sablé et apprêt sur les réparations.</li>
<li><b>Protection</b> : toiles, plastique, papier et ruban de masquage pour les planchers, les marches, les portes et le plafond suspendu.</li></ul>`,
    cols: ["#", "Description", "Qté", "Prix unit.", "Montant"],
    rows: ["Total des articles", "Frais généraux 10 %", "Profit 5 %", "TPS 5 %", "TVQ 9,975 %", "TOTAL"],
    asked: "SOMMAIRE — travaux demandés",
    option: "Option — Cuisine A208 (non comprise dans le total ci-dessus)",
    optionNote:
      "Article optionnel, à ajouter si vous le souhaitez. Ce prix vaut s'il est fait en même temps que les travaux ci-dessus.",
    totals: ["TOTAL (sans la cuisine)", "TOTAL — option cuisine"],
    withKitchen: "Avec la cuisine",
    wallsLine: (sqft: number, kitchen: number, rate: string) => `Murs peints : ${sqft} pi² (+ ${kitchen} cuisine) — ${rate}/pi² avant frais`,
    hoursLine: (h: string, k: string) => `Main-d'œuvre : ${h} h (+ ${k} h cuisine)`,
    quantities: (a: (n: number) => string) =>
      `<b>Quantités</b> : relevées sur notre dessin des plans fournis, ajusté aux superficies imprimées (murs : ${a(WALLS.entrance)} hall, ${a(WALLS.stair)} escalier, ${a(WALLS.vestibule)} vestibule, ${a(WALLS.kitchen)} cuisine). Elles seront confirmées au mesurage sur place; le prix suit les quantités réelles.`,
    includes:
      "<b>Comprend</b> : la main-d'œuvre et tous les matériaux (peinture, plâtre, protection), les petites réparations du bas des murs et le nettoyage chaque jour.",
    clientIncludes:
      "<b>Comprend</b> : la main-d'œuvre, le plâtre et tout le matériel de protection, les petites réparations du bas des murs et le nettoyage chaque jour.",
    excludes:
      "<b>Exclus</b> : plafonds et plafond suspendu, portes et cadres, rampes et garde-corps, marches, réparations majeures du placoplâtre (125 $ par réparation si on en trouve), gris foncé (supplément de 0,95 $/pi²). Valide 30 jours.",
  },
  en: {
    money: (cents: number) =>
      "$" + (cents / 100).toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    area: (n: number) => n.toLocaleString("en-CA") + " sq ft",
    title: "Estimate — Painting of the common areas",
    heading: "Estimate — Painting of the daycare's common areas",
    textTitle: "ESTIMATE — Daycare: entrance hall, stairwell, Vestibule 200 (+ kitchen option)",
    city: "Laval, Quebec",
    gst: "GST",
    qst: "QST",
    date: "Date: 2026-11-14",
    client: "Client:",
    intro:
      "New grey colour, two coats, on the walls of the entrance hall, the stairwell and Vestibule 200 upstairs, with the small repairs at the bottom of the walls. The kitchen A208 is offered as an option.",
    labourTag: " — client-supplied paint",
    clientMaterials: `<b>You supply the paint and the primer; we supply everything else.</b>
<ul><li><b>By you</b>: about ${NEED.base.paintGal} gallons (3.78 L) of the grey of your choice for two coats and ${NEED.base.primerGal} gallon of primer (kitchen, if chosen: ${NEED.kitchen.paintGal} more gallons in a washable finish and ${NEED.kitchen.primerGal} more of primer). Same colour code and finish on every can, on site when we start.</li>
<li><b>By us</b>: the plaster and sandpaper for the repairs, and all the protection: drop cloths, plastic, masking paper and tape.</li></ul>`,
    materials: `<b>All materials are supplied by Renovision AnA and included in the price — you have nothing to buy.</b>
<ul><li><b>Paint</b>: the light-to-medium grey of your choice, two coats (washable finish in the kitchen, if chosen).</li>
<li><b>Plaster</b>: joint compound for the repairs, sandpaper, and primer on the repairs.</li>
<li><b>Protection</b>: drop cloths, plastic, masking paper and tape for the floors, the steps, the doors and the suspended ceiling.</li></ul>`,
    cols: ["#", "Description", "Qty", "Unit price", "Amount"],
    rows: ["Items total", "Overhead 10 %", "Profit 5 %", "GST 5 %", "QST 9.975 %", "TOTAL"],
    asked: "SUMMARY — work requested",
    option: "Option — Kitchen A208 (not included in the total above)",
    optionNote: "Optional item, to add if you wish. This price holds when it is done at the same time as the work above.",
    totals: ["TOTAL (without the kitchen)", "TOTAL — kitchen option"],
    withKitchen: "With the kitchen",
    wallsLine: (sqft: number, kitchen: number, rate: string) => `Painted walls: ${sqft} sq ft (+ ${kitchen} kitchen) — ${rate}/sq ft before overhead`,
    hoursLine: (h: string, k: string) => `Labour: ${h} h (+ ${k} h kitchen)`,
    quantities: (a: (n: number) => string) =>
      `<b>Quantities</b>: taken from our drawing of the plans provided, matched to the printed areas (walls: ${a(WALLS.entrance)} hall, ${a(WALLS.stair)} stairwell, ${a(WALLS.vestibule)} vestibule, ${a(WALLS.kitchen)} kitchen). They will be confirmed by measuring on site; the price follows the actual quantities.`,
    includes:
      "<b>Includes</b>: the labour and all the materials (paint, plaster, protection), the small repairs at the bottom of the walls, and cleanup every day.",
    clientIncludes:
      "<b>Includes</b>: the labour, the plaster and all the protection materials, the small repairs at the bottom of the walls, and cleanup every day.",
    excludes:
      "<b>Excludes</b>: ceilings and the suspended ceiling, doors and frames, railings and guards, steps, major drywall repairs ($125 per repair if any are found), dark grey (extra $0.95/sq ft). Valid 30 days.",
  },
} as const;

type Totals = ReturnType<typeof buildGarderieDevis>["base"]["totals"];

function write(locale: Locale, stem: string, supply: GarderieSupply = "ours") {
  const c = COPY[locale];
  const t = ESTIMATOR_STRINGS[locale];
  const { base, kitchen } = buildGarderieDevis(locale, supply);
  const theirs = supply === "client-paint";
  const tag = theirs ? c.labourTag : "";
  const rowsOf = (x: Totals, last: string): [string, number][] =>
    [x.itemsCents, x.generalsCents, x.profitCents, x.gstCents, x.qstCents, x.totalCents].map((v, i) => [i === 5 ? last : c.rows[i], v]);
  const qty = (l: AllocatedLine) => `${t.qty(l.quantity)} ${unitLabel(l.unit, locale)}`;

  const out: string[] = [c.textTitle + tag, ""];
  const print = (lines: AllocatedLine[]) =>
    lines.forEach((l, i) => {
      out.push(
        `${String(i + 1).padEnd(4)}${(l.itemCode ?? "PROVISION").padEnd(18)}${l.name.slice(0, 50).padEnd(52)}` +
          `${qty(l).padStart(12)}${c.money(l.baseCents).padStart(13)}${c.money(l.totalCents).padStart(13)}`,
      );
      out.push(`      [${l.roomName}] CALC: ${l.calc}`);
      if (l.note) out.push(`      NOTE: ${l.note}`);
    });
  print(base.lines);
  out.push("", c.asked);
  rowsOf(base.totals, c.totals[0]).forEach(([k, v]) => out.push(`  ${k.padEnd(28)}${c.money(v).padStart(14)}`));
  out.push("", c.option.toUpperCase());
  print(kitchen.lines);
  rowsOf(kitchen.totals, c.totals[1]).forEach(([k, v]) => out.push(`  ${k.padEnd(28)}${c.money(v).padStart(14)}`));
  out.push("", `  ${c.withKitchen.padEnd(28)}${c.money(base.totals.totalCents + kitchen.totals.totalCents).padStart(14)}`);
  const sqft = WALLS.entrance + WALLS.stair + WALLS.vestibule;
  out.push(`  ${c.wallsLine(sqft, WALLS.kitchen, c.money(Math.round(base.totals.itemsCents / sqft)))}`);
  const hours = (ls: AllocatedLine[]) => ls.reduce((h, l) => h + l.laborHours, 0);
  out.push(`  ${c.hoursLine(hours(base.lines).toFixed(1), hours(kitchen.lines).toFixed(1))}`);
  const text = out.join("\n");
  console.log("\n" + text + "\n");
  writeFileSync(`${stem}.txt`, text);

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
        }</td><td class="r">${qty(l)}</td><td class="r">${c.money(l.replaceRateCents ?? 0)}</td><td class="r">${c.money(l.baseCents)}</td></tr>`;
      })
      .join("");
  };
  const summary = (x: Totals, last: string) =>
    `<table class="s">${rowsOf(x, last).map(([k, v]) => `<tr><td>${k}</td><td class="r">${c.money(v)}</td></tr>`).join("")}</table>`;
  const [h0, h1, h2, h3, h4] = c.cols;
  const head = `<tr><th>${h0}</th><th>${h1}</th><th class="r">${h2}</th><th class="r">${h3}</th><th class="r">${h4}</th></tr>`;
  const html = `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><title>${c.title}${tag}</title>
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
.opt{break-inside:avoid}.on{margin:-2px 0 8px;font-size:9pt;color:#555;font-style:italic}
.mat{border:2px solid #1f5fa8;background:#eef3fa;padding:8px 12px;margin:0 0 14px;font-size:9.5pt}.mat b:first-child{color:#1f5fa8}.mat ul{margin:5px 0 0 18px;padding:0}.mat li{margin:2px 0}
.x{margin-top:18px;font-size:8.5pt;color:#555}.x p{margin:4px 0}
</style></head><body>
<div class="h"><div><b>Renovision AnA inc.</b><div>${c.city} · 579-999-5979 · info@renovisionana.ca · renovisionana.ca</div></div>
<div class="r">${c.gst} 778981019 RT0001<br>${c.qst} 1230209096 IC0001<br>${c.date}</div></div>
<h1>${c.heading}${tag}</h1>
<div class="m">${c.client} ${esc(client)} · ${esc(address)}<br>
${c.intro}</div>
<div class="mat">${theirs ? c.clientMaterials : c.materials}</div>
<table>${head}${table(base.lines)}</table>
${summary(base.totals, c.totals[0])}
<div class="opt"><h2>${c.option}</h2>
<p class="on">${c.optionNote}</p>
<table>${head}${table(kitchen.lines)}</table>
${summary(kitchen.totals, c.totals[1])}</div>
<table class="g"><tr><td>${c.withKitchen}</td><td class="r">${c.money(base.totals.totalCents + kitchen.totals.totalCents)}</td></tr></table>
<div class="x">
<p>${c.quantities(c.area)}</p>
<p>${theirs ? c.clientIncludes : c.includes}</p>
<p>${c.excludes}</p>
</div>
</body></html>`;
  writeFileSync(`${stem}.html`, html);
}

describe("worked sample — daycare common areas, grey", () => {
  it("prices the repaint, in French", () => write("fr", "/tmp/garderie-devis"));
  it("prices the repaint, in English", () => write("en", "/tmp/garderie-devis.en"));
  it("prices it with her paint, in French", () => write("fr", "/tmp/garderie-devis.labour", "client-paint"));
  it("prices it with her paint, in English", () => write("en", "/tmp/garderie-devis.labour.en", "client-paint"));
});
