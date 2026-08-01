import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/constants";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // /admin also carries meta noindex — the disallow is belt and
      // suspenders, and keeps crawlers from wasting budget on it.
      disallow: ["/api/", "/admin"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
