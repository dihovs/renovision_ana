import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Chromium is not bundled, it is REQUIRED at runtime.
   *
   * `@sparticuz/chromium` ships a ~50MB compressed browser binary and
   * `puppeteer-core` reaches for Node internals. Left to the bundler,
   * Turbopack tries to trace and inline the lot — a local build went from
   * seconds to 15.9 minutes, and the function it produces would blow the
   * serverless size limit on the way to failing at runtime anyway, because
   * a browser executable is not something you can `import`.
   *
   * Listing them here leaves both as plain `require`s resolved from
   * node_modules at run time, which is the only way either works.
   */
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
  /**
   * ...but leaving it external is only half of it, and the missing half is
   * what shipped broken: "Could not build the PDF: the input directory
   * /var/task/node_modules/@sparticuz/chromium/bin does not exist".
   *
   * The message blames a bundler relocating the package, which is the usual
   * cause and is NOT what happened here — `serverExternalPackages` above
   * already prevents that. The real reason is quieter. Nothing ever imports
   * those files: `chromium.executablePath()` reads `bin/` from disk at run
   * time, so Next's file tracer, which follows imports, has no reason to
   * believe they are needed and does not copy them into the function. The
   * package is external, present, and empty of the one thing it exists for.
   *
   * Tracing follows imports; this is a runtime path. The two only meet if
   * you say so, which is what this does. Keys are route paths — the
   * `(internal)` group is not part of a URL, and `*` covers the `[id]`
   * segment without the escaping the bracketed form needs.
   *
   * Scoped to the two route handlers that actually launch a browser rather
   * than a broad `/admin/**`: the payload is 66MB of compressed Chromium and
   * every matching route pays for it whether or not it renders anything. The
   * `/report` PAGE is deliberately not here — it links to the pdf route and
   * mentions this file in a comment, which is enough to look like a
   * dependency in a grep and is not one.
   *
   * To check this stayed true after a build:
   *   grep -l chromium/bin $(find .next -name '*.nft.json')
   * Two route.js entries is right. A page.js entry is 66MB of waste; none at
   * all means the PDF button is broken again.
   */
  outputFileTracingIncludes: {
    "/admin/projects/*/report/pdf": ["./node_modules/@sparticuz/chromium/bin/**/*"],
    "/admin/projects/*/estimate/pdf": ["./node_modules/@sparticuz/chromium/bin/**/*"],
  },
  experimental: {
    // The marketing tree and the internal tree each own a root layout, and the
    // marketing one lives under a dynamic `[lang]` segment — the two cases the
    // Next docs name for this flag. Without it there is no layout for an
    // unmatched URL to compose a 404 from, so Next falls back to its stock
    // bare page. See src/app/global-not-found.tsx.
    globalNotFound: true,
  },
  /**
   * Was: `/gestionnaires` → `/commercial` redirect, removed Sep 2026 when a
   * standalone property-manager page was built at `/gestionnaires`. The old
   * redirect kept the page unreachable; now both `/assureurs` and
   * `/gestionnaires` serve their own content.
   */
  async redirects() {
    return [];
  },
  async headers() {
    // ORDER MATTERS. Both blocks match a /crew/<token> request, and when two
    // rules set the same header, the later one wins. The sitewide baseline
    // therefore comes FIRST and the capability-URL override comes after it —
    // reversed, the baseline's strict-origin-when-cross-origin silently
    // overwrites no-referrer on exactly the pages that needed it, which is
    // how the first deploy of this file shipped the leak it was written to
    // stop. Verified against production headers, not assumed.
    return [
      {
        // Sitewide baseline. Deliberately dull rather than clever: no framing
        // (clickjacking the quote-approval or invoice pages is the expensive
        // kind), no MIME sniffing, and origin-only referrers so the marketing
        // pages still attribute their traffic normally.
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        /**
         * Keep capability URLs out of other people's logs.
         *
         * `/crew/<token>`, `/hub/<token>`, `/q/<token>` and `/i/<token>` are
         * all capability links: holding the URL *is* the authorisation. The
         * crew page links out to Google Maps for the site address, and by
         * default the browser sends the whole current URL as the `Referer` on
         * that navigation — handing Google a working key to a customer's job.
         * The same shape applies to the client hub, a quote awaiting approval,
         * and a public invoice.
         *
         * `no-referrer` rather than `strict-origin-when-cross-origin`: the
         * latter still sends the origin, and nothing linked from these pages
         * has any business knowing where the click came from. There is no
         * analytics case here worth a leaked token.
         *
         * These pages already carry `noindex` in their own metadata; the
         * header is the other half, because a link that leaks is findable
         * whether or not a crawler was ever invited.
         */
        source: "/:section(crew|hub|q|i)/:token*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
        ],
      },
    ];
  },
};

export default nextConfig;
