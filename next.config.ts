import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // The marketing tree and the internal tree each own a root layout, and the
    // marketing one lives under a dynamic `[lang]` segment — the two cases the
    // Next docs name for this flag. Without it there is no layout for an
    // unmatched URL to compose a 404 from, so Next falls back to its stock
    // bare page. See src/app/global-not-found.tsx.
    globalNotFound: true,
  },
};

export default nextConfig;
