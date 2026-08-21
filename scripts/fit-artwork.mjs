// Fit every icon's viewBox to its own bounding box: 16% padding, centred,
// square. Optical sizing is what makes a grid of icons read as one set — a
// bathtub filling its tile beside a floor drain that is a speck looks
// careless however well each is drawn alone.
//
// Run after ANY artwork delivery, before install-object-artwork.py. Lived in
// /tmp for most of 21 Aug and had to be rewritten from memory twice.
//
//     node scripts/fit-artwork.mjs

import puppeteer from "puppeteer-core";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import path from "node:path";
const dir = "ios/App/App/Native/Artwork";
const files = readdirSync(dir).filter((f) => f.endsWith(".svg"));
const b = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, args: ["--no-sandbox"] });
const p = await b.newPage();
await p.setContent("<div id=h></div>");
let changed = 0;
for (const f of files) {
  const full = path.join(dir, f);
  const svg = readFileSync(full, "utf8");
  const box = await p.evaluate((markup) => {
    const h = document.getElementById("h"); h.innerHTML = markup;
    const { x, y, width, height } = h.querySelector("svg").getBBox();
    return { x, y, width, height };
  }, svg);
  if (!(box.width > 0 && box.height > 0)) continue;
  const side = Math.max(box.width, box.height) * 1.16;
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  const vb = `${(cx - side/2).toFixed(2)} ${(cy - side/2).toFixed(2)} ${side.toFixed(2)} ${side.toFixed(2)}`;
  const out = svg.replace(/viewBox="[^"]*"/, `viewBox="${vb}"`);
  if (out !== svg) { writeFileSync(full, out); changed++; }
}
await b.close();
console.log(`${changed} of ${files.length} viewBoxes fitted`);
