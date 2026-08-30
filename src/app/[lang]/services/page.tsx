import ServicesContent from "@/components/pages/ServicesContent";
import { HOME_LABEL, breadcrumbJsonLd, localizedMetadata } from "@/lib/seo";
import { toLocale } from "@/i18n/routing";

export const generateMetadata = localizedMetadata({
  path: "/services",
  fr: {
    title: "Nos services de rénovation à Laval et Montréal",
    description:
      "Dégât d'eau, planchers, cuisines et salles de bain, sous-sols, gypse, peinture et petites réparations : tous nos services à Laval et dans le grand Montréal.",
  },
  en: {
    title: "Services",
    description:
      "Water damage restoration, flooring, kitchens and bathrooms, renovations, basements, drywall, painting, and small repairs — in Laval and Montreal.",
  },
});

export default async function ServicesPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const locale = toLocale((await params).lang);
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      breadcrumbJsonLd(locale, [
        { name: HOME_LABEL[locale], path: "/" },
        { name: "Services", path: "/services" },
      ]),
    ],
  };

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
