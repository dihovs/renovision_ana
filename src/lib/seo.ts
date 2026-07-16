import type { Metadata } from "next";
import { SITE_NAME, SITE_URL } from "./constants";

/**
 * Every page.tsx should build its metadata through this instead of a raw
 * object literal. Next.js does not deep-merge a page's `openGraph`/`twitter`
 * with the root layout's — specifying either replaces it wholesale, and
 * omitting them entirely falls back to the layout default. Without this
 * helper, every inner page silently shared the homepage's OG/Twitter
 * title and description when shared on social media.
 */
export function buildMetadata({
  title,
  description,
  path = "",
}: {
  title: string;
  description: string;
  path?: string;
}): Metadata {
  const url = `${SITE_URL}${path}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      locale: "en_US",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}
