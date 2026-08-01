import RepairsContent from "@/components/pages/RepairsContent";
import { breadcrumbJsonLd, buildMetadata } from "@/lib/seo";
import { SITE_URL } from "@/lib/constants";

export const metadata = buildMetadata({
  title: "Petites réparations à Laval et Montréal",
  description:
    "Petites réparations économiques avec agencement de couleurs précis à Laval et Montréal — résultat invisible, sans refaire toute la pièce. Soumission gratuite.",
  path: "/services/repairs",
});

// Service schema tied to the single canonical business @id (same pattern as
// the service-area pages), plus a French breadcrumb trail.
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Service",
      name: "Petites réparations et agencement de couleurs",
      serviceType: "Réparations et retouches intérieures",
      description:
        "Réparations locales économiques avec agencement de couleurs précis, pour corriger les dommages sans refaire toute la pièce.",
      provider: { "@id": `${SITE_URL}/#business` },
      areaServed: [
        { "@type": "City", name: "Laval" },
        { "@type": "City", name: "Montréal" },
      ],
      url: `${SITE_URL}/services/repairs`,
    },
    breadcrumbJsonLd([
      { name: "Accueil", path: "/" },
      { name: "Services", path: "/services" },
      { name: "Petites réparations et agencement de couleurs", path: "/services/repairs" },
    ]),
  ],
};

export default function RepairsPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <RepairsContent />
    </>
  );
}
