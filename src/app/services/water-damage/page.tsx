import WaterDamageContent from "@/components/pages/WaterDamageContent";
import { breadcrumbJsonLd, buildMetadata } from "@/lib/seo";
import { SITE_URL } from "@/lib/constants";

export const metadata = buildMetadata({
  title: "Restauration après dégât d'eau à Laval et Montréal",
  description:
    "Extraction d'eau, séchage et remise en état après un dégât d'eau à Laval et Montréal. Intervention rapide 7 jours sur 7 — appelez pour une soumission gratuite.",
  path: "/services/water-damage",
});

// Service schema tied to the single canonical business @id (same pattern as
// the service-area pages), plus a French breadcrumb trail. French text only:
// the served page is French, and Google expects markup to match visible copy.
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Service",
      name: "Restauration après dégât d'eau",
      serviceType: "Restauration après dégât d'eau",
      description:
        "Extraction d'eau, séchage, assèchement et remise en état complète après un dégât d'eau, pour propriétaires, gestionnaires immobiliers et assureurs.",
      provider: { "@id": `${SITE_URL}/#business` },
      areaServed: [
        { "@type": "City", name: "Laval" },
        { "@type": "City", name: "Montréal" },
      ],
      url: `${SITE_URL}/services/water-damage`,
    },
    breadcrumbJsonLd([
      { name: "Accueil", path: "/" },
      { name: "Services", path: "/services" },
      { name: "Restauration après dégât d'eau", path: "/services/water-damage" },
    ]),
  ],
};

export default function WaterDamagePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <WaterDamageContent />
    </>
  );
}
