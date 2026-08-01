import ServicesContent from "@/components/pages/ServicesContent";
import { breadcrumbJsonLd, buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Nos services de rénovation à Laval et Montréal",
  description:
    "Dégât d'eau, planchers, cuisines et salles de bain, sous-sols, gypse, peinture et petites réparations : tous nos services à Laval et dans le grand Montréal.",
  path: "/services",
});

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    breadcrumbJsonLd([
      { name: "Accueil", path: "/" },
      { name: "Services", path: "/services" },
    ]),
  ],
};

export default function ServicesPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ServicesContent />
    </>
  );
}
