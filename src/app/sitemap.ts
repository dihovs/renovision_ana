import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/constants";
import { blogPosts, parseBlogDate } from "@/lib/blogPosts";
import { serviceAreas } from "@/lib/serviceAreas";

const routes = [
  "",
  "/estimation",
  "/services",
  "/services/water-damage",
  "/services/flooring",
  "/services/kitchen-bath",
  "/services/renovations",
  "/services/basements",
  "/services/drywall",
  "/services/painting",
  "/services/repairs",
  "/commercial",
  "/about",
  "/gallery",
  "/case-studies",
  "/safety",
  "/careers",
  "/blog",
  "/contact",
  "/service-areas",
  "/privacy",
];

// Real, stable dates — not `new Date()`. Building the sitemap at deploy time
// with "now" told Google that all thirty URLs changed on every deploy, which
// teaches it to ignore our `lastmod` entirely. The blog array below already
// used each post's real publish date; these two constants extend the same
// discipline to the rest of the site.
//
// Bump these by hand when the copy actually changes:
//   MARKETING_LAST_UPDATED — the static marketing routes above.
//   AREAS_LAST_UPDATED     — the sourced content in `src/lib/serviceAreas.ts`.
const MARKETING_LAST_UPDATED = new Date("2026-08-02");
const AREAS_LAST_UPDATED = new Date("2026-07-28");

export default function sitemap(): MetadataRoute.Sitemap {
  const staticEntries: MetadataRoute.Sitemap = routes.map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified: MARKETING_LAST_UPDATED,
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority: route === "" ? 1 : 0.7,
  }));

  // Individual posts were missing entirely — only the /blog index was listed,
  // so the actual articles had no sitemap entry pointing Google at them.
  // `lastModified` uses each post's real publish date rather than "now", so a
  // rebuild doesn't keep telling crawlers unchanged posts just changed.
  const postEntries: MetadataRoute.Sitemap = blogPosts.map((post) => ({
    url: `${SITE_URL}/blog/${post.slug}`,
    lastModified: parseBlogDate(post.publishedAt),
    changeFrequency: "yearly",
    priority: 0.6,
  }));

  const areaEntries: MetadataRoute.Sitemap = serviceAreas.map((area) => ({
    url: `${SITE_URL}/service-areas/${area.slug}`,
    lastModified: AREAS_LAST_UPDATED,
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  return [...staticEntries, ...areaEntries, ...postEntries];
}
