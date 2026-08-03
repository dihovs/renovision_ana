import { describe, expect, it } from "vitest";
import { buildMetadata } from "./seo";
import { SITE_NAME, SITE_URL } from "./constants";

describe("buildMetadata", () => {
  it("defaults to og:type website with the brand-suffixed social title", () => {
    const meta = buildMetadata({ title: "Contact", description: "d", path: "/contact" });
    expect(meta.openGraph).toMatchObject({
      type: "website",
      title: `Contact | ${SITE_NAME}`,
      url: `${SITE_URL}/contact`,
    });
    // The website arm must not leak article fields.
    expect(meta.openGraph).not.toHaveProperty("publishedTime");
  });

  it("does not double the brand suffix when the title already carries it", () => {
    const meta = buildMetadata({ title: `Blogue | ${SITE_NAME}`, description: "d" });
    expect(meta.openGraph?.title).toBe(`Blogue | ${SITE_NAME}`);
  });

  it("emits og:type article with publishedTime passed through verbatim", () => {
    // Bare YYYY-MM-DD in, bare YYYY-MM-DD out — any datetime conversion here
    // would reintroduce the UTC-midnight rollback parseBlogDate exists to avoid.
    const meta = buildMetadata({
      title: "Post",
      description: "d",
      path: "/blog/post",
      article: { publishedTime: "2026-07-22" },
    });
    expect(meta.openGraph).toMatchObject({ type: "article", publishedTime: "2026-07-22" });
    // Shared OG fields must survive the article branch untouched.
    expect(meta.openGraph).toMatchObject({ locale: "fr_CA", siteName: SITE_NAME });
  });
});
