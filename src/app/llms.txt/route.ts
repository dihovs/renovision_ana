import { blogPosts } from "@/lib/blogPosts";
import {
  SITE_ADDRESS,
  SITE_EMAIL,
  SITE_NAME,
  SITE_PHONE,
  SITE_URL,
} from "@/lib/constants";

/**
 * `/llms.txt` — a plain-text summary of the site for AI crawlers, so answer
 * engines citing the business have the real details rather than whatever they
 * scrape out of the rendered pages.
 *
 * Served as a route (not a static file in /public) so the contact details and
 * blog list stay generated from the same source of truth the site renders
 * from, and can't drift out of date.
 */
export const dynamic = "force-static";

const SERVICES = [
  ["Water damage restoration", "/services/water-damage"],
  ["Flooring", "/services/flooring"],
  ["Kitchen & bathroom remodeling", "/services/kitchen-bath"],
  ["General renovations", "/services/renovations"],
  ["Basement finishing", "/services/basements"],
  ["Small repairs & handyman work", "/services/repairs"],
] as const;

const PAGES = [
  ["About", "/about"],
  ["Commercial & property managers", "/commercial"],
  ["Case studies", "/case-studies"],
  ["Safety & certifications", "/safety"],
  ["Gallery", "/gallery"],
  ["Careers", "/careers"],
  ["Contact", "/contact"],
] as const;

export function GET() {
  const body = `# ${SITE_NAME}

> Renovation and water damage restoration contractor serving Laval and greater
> Montreal, Quebec. Works with property managers, insurers, and homeowners.

The site is bilingual (French and English); French is the default language.

## Contact

- Phone: ${SITE_PHONE}
- Email: ${SITE_EMAIL}
- Address: ${SITE_ADDRESS.streetAddress}, ${SITE_ADDRESS.addressLocality}, ${SITE_ADDRESS.addressRegion} ${SITE_ADDRESS.postalCode}, Canada
- Website: ${SITE_URL}

## Services

${SERVICES.map(([label, path]) => `- [${label}](${SITE_URL}${path})`).join("\n")}

## Pages

${PAGES.map(([label, path]) => `- [${label}](${SITE_URL}${path})`).join("\n")}

## Articles

${blogPosts
  .map(
    (post) =>
      `- [${post.en.title}](${SITE_URL}/blog/${post.slug}) — ${post.en.excerpt}`,
  )
  .join("\n")}

## Notes

- Estimates quoted through the site's chat assistant are preliminary and are
  confirmed by an on-site visit before any work is scheduled.
- Service area covers Laval, Montreal, and surrounding municipalities.
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
