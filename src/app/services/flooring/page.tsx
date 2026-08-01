import FlooringContent from "@/components/pages/FlooringContent";
import { breadcrumbJsonLd, buildMetadata } from "@/lib/seo";
import { SITE_URL } from "@/lib/constants";

export const metadata = buildMetadata({
  title: "Pose de planchers à Laval et Montréal",
  description:
    "Pose de planchers de bois franc, de vinyle et de céramique à Laval et Montréal. Installation précise, finition soignée — demandez votre soumission gratuite.",
  path: "/services/flooring",
});

// Service schema tied to the single canonical business @id (same pattern as
// the service-area pages), plus a French breadcrumb trail.
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Service",
      name: "Pose de planchers",
      serviceType: "Pose de revêtements de sol",
      description:
        "Installation de planchers de bois franc, de vinyle et de céramique, avec préparation du support et finition soignée.",
      provider: { "@id": `${SITE_URL}/#business` },
      areaServed: [
        { "@type": "City", name: "Laval" },
        { "@type": "City", name: "Montréal" },
      ],
      url: `${SITE_URL}/services/flooring`,
    },
    breadcrumbJsonLd([
      { name: "Accueil", path: "/" },
      { name: "Services", path: "/services" },
      { name: "Pose de planchers", path: "/services/flooring" },
    ]),
  ],
};

export default function FlooringPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <FlooringContent />
    </>
  );
}
