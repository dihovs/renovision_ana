import ServicesContent from "@/components/pages/ServicesContent";
import { SERVICES_PAGE_FAQ } from "@/lib/serviceFaq";
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
  const faq = SERVICES_PAGE_FAQ[locale] ?? [];
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      breadcrumbJsonLd(locale, [
        { name: HOME_LABEL[locale], path: "/" },
        { name: "Services", path: "/services" },
      ]),
      ...(faq.length > 0
        ? [
            {
              "@type": "FAQPage",
              mainEntity: faq.map((item) => ({
                "@type": "Question",
                name: item.question,
                acceptedAnswer: {
                  "@type": "Answer",
                  text: item.answer,
                },
              })),
            },
          ]
        : []),
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
