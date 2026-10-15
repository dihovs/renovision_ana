import type { Page } from "puppeteer-core";

/**
 * **Sheet numbers for the contents page, measured rather than assumed.**
 *
 * The report numbers its SECTIONS — cover 1, summary 2, … — and that was
 * every page's number for as long as a section fitted on one sheet of
 * Letter. A devis running to three sheets, a room page with four damage
 * areas, and the numbering drifted: a 45-sheet PDF whose footers said
 * "Page 28/35" and whose contents page sent the reader to the wrong sheet
 * (SDC H1 Hymus, 15 Oct 2026). The footers now print in the page margin
 * with the browser's own sheet counter (`@page` margin boxes); this does the
 * same for the contents page, which a counter cannot reach.
 *
 * How: in print layout, a section no taller than one printable sheet takes
 * exactly one (every section starts a fresh sheet). A taller one is printed
 * ALONE, other sections hidden, and its sheets counted off the PDF it makes —
 * the browser's own fragmentation, so break-avoidance, repeated table heads
 * and photo grids are counted exactly as the real print will lay them. Then
 * each `.contents-page` figure — a section ordinal — is rewritten to the
 * sheet that section starts on.
 *
 * Fails safe: if the sections on the page do not match the ordinals the
 * contents page uses, nothing is rewritten.
 */

/** Letter less the report's 2 cm margins, in CSS pixels (96 dpi). */
const PRINTABLE_WIDTH_PX = Math.floor(8.5 * 96 - (2 / 2.54) * 96 * 2);
const PRINTABLE_HEIGHT_PX = 11 * 96 - (2 / 2.54) * 96 * 2;

export type SheetPdfOptions = Parameters<Page["pdf"]>[0];

function countPages(pdf: Uint8Array): number {
  // Every page object of a Chromium PDF carries `/Type /Page` (the page TREE
  // says `/Pages`). No parser needed to count them.
  const text = Buffer.from(pdf).toString("latin1");
  return (text.match(/\/Type\s*\/Page(?![a-zA-Z])/g) ?? []).length;
}

export async function numberSheets(page: Page, pdfOptions: SheetPdfOptions): Promise<number | null> {
  await page.emulateMediaType("print");
  await page.setViewport({ width: PRINTABLE_WIDTH_PX, height: 1200 });

  const heights: number[] = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>(".report > .page")).map((section) => {
      section.removeAttribute("data-sheet-probe");
      return section.getBoundingClientRect().height;
    }),
  );
  if (heights.length === 0) return null;

  const sheets: number[] = [];
  for (let index = 0; index < heights.length; index += 1) {
    // A hair of slack: a section filling the sheet exactly still fits.
    if (heights[index] <= PRINTABLE_HEIGHT_PX + 1) {
      sheets.push(1);
      continue;
    }
    await page.evaluate((i: number) => {
      const sections = document.querySelectorAll<HTMLElement>(".report > .page");
      sections.forEach((section, k) => {
        section.style.display = k === i ? "" : "none";
      });
    }, index);
    const probe = await page.pdf(pdfOptions);
    sheets.push(Math.max(1, countPages(probe)));
  }
  await page.evaluate(() => {
    document.querySelectorAll<HTMLElement>(".report > .page").forEach((section) => {
      section.style.display = "";
    });
  });

  const starts: number[] = [];
  let at = 1;
  for (const count of sheets) {
    starts.push(at);
    at += count;
  }
  const total = at - 1;

  await page.evaluate((startSheets: number[]) => {
    const cells = Array.from(document.querySelectorAll<HTMLElement>(".contents-page"));
    const ordinals = cells.map((cell) => Number.parseInt(cell.textContent ?? "", 10));
    // The ordinals must name real sections, or the mapping is not ours to make.
    if (ordinals.some((n) => !Number.isFinite(n) || n < 1 || n > startSheets.length)) return;
    cells.forEach((cell, k) => {
      cell.textContent = String(startSheets[ordinals[k] - 1]);
    });
  }, starts);

  return total;
}
