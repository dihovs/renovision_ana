import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
