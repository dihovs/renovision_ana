import BasementsContent from "@/components/pages/BasementsContent";
import { breadcrumbJsonLd, buildMetadata } from "@/lib/seo";
import { SITE_URL } from "@/lib/constants";

export const metadata = buildMetadata({
  title: "Aménagement de sous-sol à Laval et Montréal",
  description:
    "Aménagement de sous-sol à Laval et Montréal : d'un espace brut à des pièces habitables et accueillantes. Demandez votre soumission gratuite dès aujourd'hui.",
  path: "/services/basements",
});

// Service schema tied to the single canonical business @id (same pattern as
// the service-area pages), plus a French breadcrumb trail.
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Service",
      name: "Aménagement de sous-sol",
      serviceType: "Aménagement de sous-sol",
      description:
        "Transformation de sous-sols bruts en pièces habitables : isolation, gypse, planchers, éclairage et finition complète.",
      provider: { "@id": `${SITE_URL}/#business` },
      areaServed: [
        { "@type": "City", name: "Laval" },
        { "@type": "City", name: "Montréal" },
      ],
      url: `${SITE_URL}/services/basements`,
    },
    breadcrumbJsonLd([
      { name: "Accueil", path: "/" },
      { name: "Services", path: "/services" },
      { name: "Aménagement de sous-sol", path: "/services/basements" },
    ]),
  ],
};

export default function BasementsPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <BasementsContent />
    </>
  );
}
