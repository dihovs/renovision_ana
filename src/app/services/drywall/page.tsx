import DrywallContent from "@/components/pages/DrywallContent";
import { breadcrumbJsonLd, buildMetadata } from "@/lib/seo";
import { SITE_URL } from "@/lib/constants";

export const metadata = buildMetadata({
  title: "Pose et finition de gypse à Laval et Montréal",
  description:
    "Installation, tirage de joints et réparation de gypse à Laval et Montréal — panneaux standards, hydrofuges et coupe-feu, prêts à peindre. Soumission gratuite.",
  path: "/services/drywall",
});

// Service schema tied to the single canonical business @id (same pattern as
// the service-area pages), plus a French breadcrumb trail.
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Service",
      name: "Installation et finition de gypse",
      serviceType: "Pose et finition de gypse",
      description:
        "Pose, tirage de joints et finition de gypse — panneaux standards, hydrofuges et coupe-feu — ainsi que réparations de toutes tailles.",
      provider: { "@id": `${SITE_URL}/#business` },
      areaServed: [
        { "@type": "City", name: "Laval" },
        { "@type": "City", name: "Montréal" },
      ],
      url: `${SITE_URL}/services/drywall`,
    },
    breadcrumbJsonLd([
      { name: "Accueil", path: "/" },
      { name: "Services", path: "/services" },
      { name: "Installation et finition de gypse", path: "/services/drywall" },
    ]),
  ],
};

export default function DrywallPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <DrywallContent />
    </>
  );
}
