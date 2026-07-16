import { SITE_ADDRESS, SITE_EMAIL, SITE_NAME, SITE_PHONE_TEL, SITE_URL } from "@/lib/constants";
import { translations } from "@/i18n/translations";

// The single canonical schema block for the business, rendered once in the
// root layout so it's present on every page. Reviews are sourced from the
// same static (real, Google-sourced) testimonial data the Testimonials
// component displays — previously that component also emitted its own
// separate "LocalBusiness" schema with a different @type and no address,
// which gave Google two disconnected, competing records for one business
// instead of one entity with a shared @id.
const BUSINESS_ID = `${SITE_URL}/#business`;

export default function LocalBusinessSchema() {
  const reviews = translations.en.testimonials.items;
  const avgRating =
    reviews.reduce((sum, item) => sum + item.rating, 0) / reviews.length;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "HomeAndConstructionBusiness",
    "@id": BUSINESS_ID,
    name: SITE_NAME,
    url: SITE_URL,
    telephone: SITE_PHONE_TEL,
    email: SITE_EMAIL,
    address: {
      "@type": "PostalAddress",
      ...SITE_ADDRESS,
    },
    areaServed: SITE_ADDRESS.addressRegion,
    priceRange: "$$",
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: avgRating.toFixed(1),
      reviewCount: reviews.length,
    },
    review: reviews.map((item) => ({
      "@type": "Review",
      author: { "@type": "Person", name: item.name },
      reviewRating: {
        "@type": "Rating",
        ratingValue: item.rating,
        bestRating: 5,
      },
      reviewBody: item.quote,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
