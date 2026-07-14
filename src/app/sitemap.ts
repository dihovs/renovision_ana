import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/constants";

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
];

export default function sitemap(): MetadataRoute.Sitemap {
  return routes.map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified: new Date(),
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority: route === "" ? 1 : 0.7,
  }));
}
