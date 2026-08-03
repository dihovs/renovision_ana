import { describe, expect, it } from "vitest";
import { buildMetadata } from "./seo";
import { SITE_NAME, SITE_URL } from "./constants";

describe("buildMetadata", () => {
  it("defaults to og:type website with the brand-suffixed social title", () => {
    const meta = buildMetadata({ locale: "fr", title: "Contact", description: "d", path: "/contact" });
    expect(meta.openGraph).toMatchObject({
      type: "website",
      title: `Contact | ${SITE_NAME}`,
      url: `${SITE_URL}/contact`,
    });
    // The website arm must not leak article fields.
    expect(meta.openGraph).not.toHaveProperty("publishedTime");
  });

  it("does not double the brand suffix when the title already carries it", () => {
    const meta = buildMetadata({ locale: "fr", title: `Blogue | ${SITE_NAME}`, description: "d" });
    expect(meta.openGraph?.title).toBe(`Blogue | ${SITE_NAME}`);
  });

  it("emits og:type article with publishedTime passed through verbatim", () => {
    // Bare YYYY-MM-DD in, bare YYYY-MM-DD out — any datetime conversion here
    // would reintroduce the UTC-midnight rollback parseBlogDate exists to avoid.
    const meta = buildMetadata({
      locale: "fr",
      title: "Post",
      description: "d",
      path: "/blog/post",
      article: { publishedTime: "2026-07-22" },
    });
    expect(meta.openGraph).toMatchObject({ type: "article", publishedTime: "2026-07-22" });
    // Shared OG fields must survive the article branch untouched.
    expect(meta.openGraph).toMatchObject({ locale: "fr_CA", siteName: SITE_NAME });
  });

  it("emits the English og:locale for the English half, article or not", () => {
    // The article branch reuses openGraphShared rather than rebuilding it —
    // this is the test that would catch a copy-paste that hardcoded fr_CA
    // back in when the two branches were merged.
    const meta = buildMetadata({
      locale: "en",
      title: "Post",
      description: "d",
      path: "/blog/post",
      article: { publishedTime: "2026-07-22" },
    });
    expect(meta.openGraph).toMatchObject({ type: "article", locale: "en_CA", alternateLocale: "fr_CA" });
  });

  it("still emits the full hreflang triple on an article page", () => {
    // The bilingual routing and the article flag are independent features —
    // turning one on must not silently drop the other.
    const meta = buildMetadata({
      locale: "fr",
      title: "Post",
      description: "d",
      path: "/blog/post",
      article: { publishedTime: "2026-07-22" },
    });
    expect(meta.alternates?.languages).toMatchObject({
      "fr-CA": `${SITE_URL}/blog/post`,
      "en-CA": `${SITE_URL}/en/blog/post`,
      "x-default": `${SITE_URL}/blog/post`,
    });
  });
});
