import {
  SITE_ADDRESS,
  SITE_EMAIL,
  SITE_NAME,
  SITE_PHONE_TEL,
  SITE_URL,
  SOCIAL_LINKS,
} from "@/lib/constants";
import { translations } from "@/i18n/translations";
import { getGoogleReviewsData } from "@/lib/googleReviews";

// The single canonical schema block for the business, rendered once in the
// root layout so it's present on every page. Previously that component also
// emitted its own separate "LocalBusiness" schema with a different @type and
// no address, which gave Google two disconnected, competing records for one
// business instead of one entity with a shared @id.
const BUSINESS_ID = `${SITE_URL}/#business`;

// `areaServed` used to be a flat list of bare strings, several of them
// anglicized ("Montreal-North", "Ile-Perrot"). Bare strings give Google no
// entity to resolve, and "Laval" on its own is genuinely ambiguous with Laval,
// Mayenne, in France — which is what a brand search for this business surfaces
// today. Every place below is therefore a typed node nested inside the next
// one up, so the chain always terminates at Québec, Canada.
const QUEBEC = {
  "@type": "AdministrativeArea",
  name: "Québec",
  address: {
    "@type": "PostalAddress",
    addressRegion: "QC",
    addressCountry: "CA",
  },
};

/** A municipality in Québec. */
const city = (name: string) => ({
  "@type": "City",
  name,
  containedInPlace: QUEBEC,
});

/**
 * A borough or sector inside a municipality — Laval's sectors and Montréal's
 * arrondissements. Not `City`: they are not municipalities, and typing them as
 * such would compete with the real city node above.
 */
const borough = (name: string, parent: ReturnType<typeof city>) => ({
  "@type": "AdministrativeArea",
  name,
  containedInPlace: parent,
});

const LAVAL = city("Laval");
const MONTREAL = city("Montréal");

// French Quebec spellings throughout, matching the display names in
// `src/lib/serviceAreas.ts` so the schema and the area pages agree.
const AREAS_SERVED = [
  LAVAL,
  MONTREAL,
  // Laval sectors
  borough("Chomedey", LAVAL),
  borough("Sainte-Rose", LAVAL),
  borough("Duvernay", LAVAL),
  borough("Laval-des-Rapides", LAVAL),
  borough("Pont-Viau", LAVAL),
  borough("Vimont", LAVAL),
  borough("Fabreville", LAVAL),
  // Montréal boroughs
  borough("Ahuntsic-Cartierville", MONTREAL),
  borough("Saint-Laurent", MONTREAL),
  borough("LaSalle", MONTREAL),
  borough("Montréal-Nord", MONTREAL),
  // Off-island and West Island. The West Island is a region rather than a
  // municipality — several of its towns are not part of Ville de Montréal —
  // so it hangs off Québec directly.
  {
    "@type": "AdministrativeArea",
    name: "Ouest-de-l'Île de Montréal",
    alternateName: "West Island",
    containedInPlace: QUEBEC,
  },
  city("Île-Perrot"),
  city("Longueuil"),
  city("Terrebonne"),
];

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
    // Approximate coordinates for 68 Boulevard Cartier Ouest, Laval H7N 2A3
    // (Laval-des-Rapides, just west of Boul. des Laurentides — NOT the Laval
    // city centroid, which sits ~5 km away). Estimated from the street grid;
    // owner should confirm against Google Maps if pin-level precision matters.
    geo: {
      "@type": "GeoCoordinates",
      latitude: 45.5604,
      longitude: -73.6889,
    },
    // Confirmed by the owner 2026-08-30: the line is answered at any hour, any
    // day — Ana takes the call when the office doesn't. `00:00`–`23:59` across
    // all seven days is schema.org's way of saying that, and it is what earns
    // the "Open 24 hours" treatment in a local result.
    //
    // This describes REACHABILITY, which is what a person searching "dégât
    // d'eau" at 3am is actually asking about. It is not a claim that a crew is
    // dispatched overnight — keep the visible copy (see Header's emergency
    // strip) aligned with that same distinction.
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
        opens: "00:00",
        closes: "23:59",
      },
    ],
    // Bilingual service, declared rather than merely implied by the /en tree.
    // Both tags are the Canadian variants the hreflang set already uses.
    knowsLanguage: ["fr-CA", "en-CA"],
    // The two credentials that carry the most weight for this trade — the same
    // pair the Sécurité et garantie page states and the directory listings
    // repeat. `hasCredential` is the closest honest fit: these are assurances
    // about the business, not certifications from an awarding body, so they are
    // typed as plain descriptive credentials without inventing an issuer.
    hasCredential: [
      {
        "@type": "EducationalOccupationalCredential",
        credentialCategory: "Insurance",
        name: "Comprehensive liability insurance — certificates available on request",
      },
      {
        "@type": "EducationalOccupationalCredential",
        credentialCategory: "Warranty",
        name: "One-year written workmanship warranty",
      },
    ],
    logo: `${SITE_URL}/renovision-logo.png`,
    image: `${SITE_URL}/renovision-logo.png`,
    sameAs: [SOCIAL_LINKS.facebook, SOCIAL_LINKS.instagram],
    areaServed: AREAS_SERVED,
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
