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
  article,
}: {
  title: string;
  description: string;
  path?: string;
  /**
   * Blog posts only: flips og:type from "website" to "article" and emits
   * article:published_time, which crawlers use for freshness/date display.
   * `publishedTime` is passed through verbatim — a bare YYYY-MM-DD is valid
   * ISO 8601 and dodges the UTC-midnight rollback that stamping a fake time
   * on it would invite (see parseBlogDate in blogPosts.ts).
   */
  article?: { publishedTime: string };
}): Metadata {
  const url = `${SITE_URL}${path}`;
  // The <title> tag gets the "%s | Renovision AnA" template from the root
  // layout, but og:title/twitter:title bypass that template entirely — so the
  // brand suffix has to be applied by hand here or shared links lose it.
  const socialTitle = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;
  // The root app/opengraph-image.tsx renders the brand card, but this Next
  // version only injects that file-convention image on routes that do NOT
  // define their own `openGraph` — and every page built here defines one
  // (that's the whole point of this helper). Verified against the dev server:
  // the homepage got og:image, inner pages did not. So each page must point
  // at the generated route explicitly; metadataBase makes the URL absolute.
  const ogImage = { url: "/opengraph-image", width: 1200, height: 630 };
  const openGraphShared = {
    title: socialTitle,
    description,
    url,
    siteName: SITE_NAME,
    // The site serves French content on every URL (SSR default fr), so the
    // declared OG locale must match what a crawler actually reads.
    locale: "fr_CA",
    images: [ogImage],
  };
  return {
    title,
    description,
    alternates: { canonical: url },
    // Two literals rather than a computed `type`: Metadata's openGraph is a
    // discriminated union, and only the "article" arm accepts publishedTime.
    openGraph: article
      ? { ...openGraphShared, type: "article", publishedTime: article.publishedTime }
      : { ...openGraphShared, type: "website" },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description,
      images: [ogImage.url],
    },
  };
}

/**
 * BreadcrumbList JSON-LD node (French labels — the served content is French).
 * Returned as a plain object so pages can compose it into an `@graph` next to
 * their Service/FAQPage/BlogPosting nodes.
 */
export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${SITE_URL}${item.path}`,
    })),
  };
}
