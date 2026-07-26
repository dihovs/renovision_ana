import { SITE_ADDRESS, SITE_EMAIL, SITE_NAME, SITE_PHONE_TEL, SITE_URL } from "@/lib/constants";
import { translations } from "@/i18n/translations";
import { getGoogleReviewsData } from "@/lib/googleReviews";

// The single canonical schema block for the business, rendered once in the
// root layout so it's present on every page. Previously that component also
// emitted its own separate "LocalBusiness" schema with a different @type and
// no address, which gave Google two disconnected, competing records for one
// business instead of one entity with a shared @id.
const BUSINESS_ID = `${SITE_URL}/#business`;

export default async function LocalBusinessSchema() {
  const live = await getGoogleReviewsData();
  const staticReviews = translations.en.testimonials.items;
  // Prefer the real, live-pulled Google aggregate — it reflects the whole
  // review history, not just the curated 5-star set, which is exactly what
  // Google expects to see even when only 5-star reviews are featured
  // individually. Fall back to the average of the static reviews only when
  // the live pull isn't configured or fails.
  const reviews = live.items.length > 0 ? live.items : staticReviews;
  const avgRating =
    live.overallRating ?? staticReviews.reduce((sum, item) => sum + item.rating, 0) / staticReviews.length;
  const reviewCount = live.reviewCount ?? staticReviews.length;

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
    areaServed: [
      "Laval",
      "Chomedey",
      "Sainte-Rose",
      "Duvernay",
      "Laval-des-Rapides",
      "Pont-Viau",
      "Vimont",
      "Fabreville",
      "Ahuntsic-Cartierville",
      "Saint-Laurent",
      "LaSalle",
      "Montreal-North",
      "West Island",
      "Ile-Perrot",
      "Longueuil",
      "Terrebonne",
    ],
    priceRange: "$$",
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: avgRating.toFixed(1),
      reviewCount,
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
