import RenovationsContent from "@/components/pages/RenovationsContent";
import { breadcrumbJsonLd, buildMetadata } from "@/lib/seo";
import { SITE_URL } from "@/lib/constants";

export const metadata = buildMetadata({
  title: "Rénovation intérieure à Laval et Montréal",
  description:
    "Rénovation intérieure complète à Laval et Montréal : chambres, salons, bureaux et aires ouvertes. Travail clé en main — demandez votre soumission gratuite.",
  path: "/services/renovations",
});

// Service schema tied to the single canonical business @id (same pattern as
// the service-area pages), plus a French breadcrumb trail.
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Service",
      name: "Rénovation intérieure",
      serviceType: "Rénovation intérieure",
      description:
        "Rénovation complète de pièces et d'espaces intérieurs — chambres, salons, bureaux — de la planification à la finition.",
      provider: { "@id": `${SITE_URL}/#business` },
      areaServed: [
        { "@type": "City", name: "Laval" },
        { "@type": "City", name: "Montréal" },
      ],
      url: `${SITE_URL}/services/renovations`,
    },
    breadcrumbJsonLd([
      { name: "Accueil", path: "/" },
      { name: "Services", path: "/services" },
      { name: "Rénovation intérieure", path: "/services/renovations" },
    ]),
  ],
};

export default function RenovationsPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <RenovationsContent />
    </>
  );
}
