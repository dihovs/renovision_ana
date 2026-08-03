import type { Metadata } from "next";
import type { Locale } from "@/i18n/translations";
import { HREFLANG, OG_LOCALE, localePath, toLocale } from "@/i18n/routing";
import { SITE_NAME, SITE_URL } from "./constants";

/** Absolute URL for a locale-independent path, e.g. `/about` → `…/en/about`. */
export function localeUrl(locale: Locale, path = "/"): string {
  const localized = localePath(locale, path);
  // The site root is written without its trailing slash, which is the form
  // already indexed as the homepage canonical.
  return `${SITE_URL}${localized === "/" ? "" : localized}`;
}

/**
 * Every page.tsx should build its metadata through this instead of a raw
 * object literal. Next.js does not deep-merge a page's `openGraph`/`twitter`
 * with the root layout's — specifying either replaces it wholesale, and
 * omitting them entirely falls back to the layout default. Without this
 * helper, every inner page silently shared the homepage's OG/Twitter
 * title and description when shared on social media.
 *
 * It is also the single place the hreflang triple is emitted: `fr-CA` at the
 * unprefixed path, `en-CA` under `/en`, and `x-default` on French because
 * French is both the default locale and the canonical path.
 */
export function buildMetadata({
  locale,
  title,
  description,
  path = "/",
  article,
}: {
  locale: Locale;
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
  const url = localeUrl(locale, path);
  const alternateLocale: Locale = locale === "fr" ? "en" : "fr";
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
    locale: OG_LOCALE[locale],
    alternateLocale: OG_LOCALE[alternateLocale],
    images: [ogImage],
  };
  return {
    title,
    description,
    alternates: {
      canonical: url,
      languages: {
        [HREFLANG.fr]: localeUrl("fr", path),
        [HREFLANG.en]: localeUrl("en", path),
        "x-default": localeUrl("fr", path),
      },
    },
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

type LocaleCopy = { title: string; description: string };

/**
 * The `generateMetadata` export for a static page under `app/[lang]/`.
 *
 * Both languages sit side by side in the page file, so the copy still lives
 * next to the route it describes and no page has to unwrap `params` itself.
 * Pages with a dynamic segment (blog posts, service areas) pull their copy
 * from the data file instead and call `buildMetadata` directly.
 */
export function localizedMetadata(config: { path?: string; fr: LocaleCopy; en: LocaleCopy }) {
  return async function generateMetadata({
    params,
  }: {
    params: Promise<{ lang: string }>;
  }): Promise<Metadata> {
    const locale = toLocale((await params).lang);
    return buildMetadata({ locale, path: config.path, ...config[locale] });
  };
}

/**
 * Breadcrumb root label. The one structural string with no twin anywhere in
 * translations.ts — every other label a trail needs is already page copy.
 */
export const HOME_LABEL: Record<Locale, string> = { fr: "Accueil", en: "Home" };

/**
 * BreadcrumbList JSON-LD node. Labels are passed in already localized — the
 * markup has to match the copy the page actually renders — and the URLs are
 * built for the same locale so an English breadcrumb never points at the
 * French page.
 * Returned as a plain object so pages can compose it into an `@graph` next to
 * their Service/FAQPage/BlogPosting nodes.
 */
export function breadcrumbJsonLd(locale: Locale, items: { name: string; path: string }[]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: localeUrl(locale, item.path),
    })),
  };
}

type ServiceSchemaCopy = { name: string; serviceType: string; description: string };

/**
 * The Service + BreadcrumbList graph the eight service detail pages share.
 *
 * Both languages are declared per page because Google expects markup to match
 * the copy the page renders — French schema on an `/en` page is the same
 * mismatch the service-area pages were already fixed for. The French strings
 * are unchanged from before this route split; the English ones are the site's
 * own earlier English copy for those same services.
 */
export function serviceJsonLd(
  locale: Locale,
  config: { path: string; fr: ServiceSchemaCopy; en: ServiceSchemaCopy },
) {
  const copy = config[locale];
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Service",
        name: copy.name,
        serviceType: copy.serviceType,
        description: copy.description,
        provider: { "@id": `${SITE_URL}/#business` },
        // Place names stay in French on both: these are the cities' legal
        // names, and matching the Google Business Profile service area matters
        // more here than translating them.
        areaServed: [
          { "@type": "City", name: "Laval" },
          { "@type": "City", name: "Montréal" },
        ],
        url: localeUrl(locale, config.path),
      },
      breadcrumbJsonLd(locale, [
        { name: HOME_LABEL[locale], path: "/" },
        { name: "Services", path: "/services" },
        { name: copy.name, path: config.path },
      ]),
    ],
  };
}
