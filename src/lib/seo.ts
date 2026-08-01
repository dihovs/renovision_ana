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
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: socialTitle,
      description,
      url,
      siteName: SITE_NAME,
      // The site serves French content on every URL (SSR default fr), so the
      // declared OG locale must match what a crawler actually reads.
      locale: "fr_CA",
      type: "website",
      images: [ogImage],
    },
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
