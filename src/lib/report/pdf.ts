import chromium from "@sparticuz/chromium";
import puppeteer, { type Browser } from "puppeteer-core";

/**
 * The report, as a real PDF, produced by this app rather than by whatever
 * the reader happens to press.
 *
 * **Why this exists.** The stylesheet has been right for a while — US Letter
 * `@page`, honest `break-after: page`, a running header, `Page n/N`. The
 * owner's exports still arrived as ONE page of 681 × 14091 points with the
 * app's own menus printed at the top, because the thing producing them was a
 * full-page-screenshot tool that ignores paged media entirely. His words on
 * seeing the result: *"it's not good enough."*
 *
 * Betting a claim document on the reader choosing the right button is a bad
 * bet. So the server drives a real browser, and the file is the same every
 * time whoever asks for it.
 *
 * **It renders the page we already have**, rather than reimplementing the
 * report against a PDF drawing library. The floor plans, the dimension
 * chains, the photo grids and the damage tables are all real layout work
 * that took weeks; a second implementation would be a second thing to keep
 * true, and the two would drift the first time either changed.
 */

/** Letter, and the same 2cm the print stylesheet has always used. */
const MARGIN = "2cm";

/**
 * Chromium comes from a different place in each environment and neither is
 * the other's fallback.
 *
 * On Vercel the function ships `@sparticuz/chromium` — a build stripped down
 * to fit a serverless bundle. On this Mac there is no such binary, and
 * downloading one per run would be minutes; the Chrome already installed is
 * right there and is the same engine.
 */
async function launch(): Promise<Browser> {
  const local = process.env.NODE_ENV === "development" || process.env.CHROME_PATH;
  if (local) {
    const executablePath =
      process.env.CHROME_PATH ||
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
    return puppeteer.launch({
      executablePath,
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });
  }
  return puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true,
  });
}

export async function renderReportPdf(input: {
  /** Absolute URL of the report page, already carrying its query. */
  url: string;
  /** The caller's own session, forwarded so the page can be read at all. */
  cookieHeader: string | null;
}): Promise<Buffer> {
  const browser = await launch();
  try {
    const page = await browser.newPage();

    // The report is a signed-in page. The headless browser has no session of
    // its own, so it borrows the one that asked for the PDF — which also
    // means a PDF can never show more than the person requesting it could
    // already see.
    if (input.cookieHeader) {
      const url = new URL(input.url);
      const cookies = input.cookieHeader
        .split(";")
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => {
          const index = part.indexOf("=");
          return {
            name: part.slice(0, index),
            value: part.slice(index + 1),
            domain: url.hostname,
            path: "/",
          };
        })
        .filter((cookie) => cookie.name);
      if (cookies.length > 0) await browser.setCookie(...cookies);
    }

    // `networkidle0` rather than `load`: the floor plans and photos arrive
    // after first paint, and a PDF taken at `load` is a document with holes
    // where the drawings should be.
    await page.goto(input.url, { waitUntil: "networkidle0", timeout: 60_000 });

    // Web fonts settle after the network does, and a page measured mid-swap
    // paginates against the wrong text metrics — which moves page breaks.
    await page.evaluateHandle("document.fonts.ready");

    const pdf = await page.pdf({
      format: "letter",
      printBackground: true,
      preferCSSPageSize: false,
      margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
    });
    return Buffer.from(pdf);
  } finally {
    // Always. A leaked browser on a serverless function is a leaked
    // invocation that eventually takes the whole instance down.
    await browser.close().catch(() => {});
  }
}
