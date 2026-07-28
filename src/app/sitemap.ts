import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/constants";
import { blogPosts, parseBlogDate } from "@/lib/blogPosts";
import { serviceAreas } from "@/lib/serviceAreas";

const routes = [
  "",
  "/services",
  "/services/water-damage",
  "/services/flooring",
  "/services/kitchen-bath",
  "/services/renovations",
  "/services/basements",
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
];

export default function sitemap(): MetadataRoute.Sitemap {
  const staticEntries: MetadataRoute.Sitemap = routes.map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified: new Date(),
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
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  return [...staticEntries, ...areaEntries, ...postEntries];
}
