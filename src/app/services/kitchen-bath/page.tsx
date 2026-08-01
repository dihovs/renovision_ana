import KitchenBathContent from "@/components/pages/KitchenBathContent";
import { breadcrumbJsonLd, buildMetadata } from "@/lib/seo";
import { SITE_URL } from "@/lib/constants";

export const metadata = buildMetadata({
  title: "Rénovation de cuisine et salle de bain à Laval et Montréal",
  description:
    "Cuisines et salles de bain modernes et fonctionnelles, rénovées selon votre budget et votre style à Laval et Montréal. Demandez votre soumission gratuite.",
  path: "/services/kitchen-bath",
});

// Service schema tied to the single canonical business @id (same pattern as
// the service-area pages), plus a French breadcrumb trail.
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Service",
      name: "Rénovation de cuisine et salle de bain",
      serviceType: "Rénovation de cuisine et de salle de bain",
      description:
        "Réfection complète de cuisines et de salles de bain : armoires, comptoirs, céramique, plomberie de finition et éclairage.",
      provider: { "@id": `${SITE_URL}/#business` },
      areaServed: [
        { "@type": "City", name: "Laval" },
        { "@type": "City", name: "Montréal" },
      ],
      url: `${SITE_URL}/services/kitchen-bath`,
    },
    breadcrumbJsonLd([
      { name: "Accueil", path: "/" },
      { name: "Services", path: "/services" },
      { name: "Rénovation de cuisine et salle de bain", path: "/services/kitchen-bath" },
    ]),
  ],
};

export default function KitchenBathPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <KitchenBathContent />
    </>
  );
}
