import PaintingContent from "@/components/pages/PaintingContent";
import { breadcrumbJsonLd, buildMetadata } from "@/lib/seo";
import { SITE_URL } from "@/lib/constants";

export const metadata = buildMetadata({
  title: "Peinture intérieure à Laval et Montréal",
  description:
    "Peinture intérieure à Laval et Montréal : murs, plafonds, moulures, plinthes et portes en deux couches complètes. Demandez votre soumission gratuite.",
  path: "/services/painting",
});

// Service schema tied to the single canonical business @id (same pattern as
// the service-area pages), plus a French breadcrumb trail.
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Service",
      name: "Peinture intérieure",
      serviceType: "Peinture intérieure",
      description:
        "Peinture de murs, plafonds, moulures, plinthes et portes en deux couches complètes, avec apprêt sur gypse neuf.",
      provider: { "@id": `${SITE_URL}/#business` },
      areaServed: [
        { "@type": "City", name: "Laval" },
        { "@type": "City", name: "Montréal" },
      ],
      url: `${SITE_URL}/services/painting`,
    },
    breadcrumbJsonLd([
      { name: "Accueil", path: "/" },
      { name: "Services", path: "/services" },
      { name: "Peinture intérieure", path: "/services/painting" },
    ]),
  ],
};

export default function PaintingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PaintingContent />
    </>
  );
}
