import { notFound } from "next/navigation";
import ServiceAreaContent from "@/components/pages/ServiceAreaContent";
import { HOME_LABEL, breadcrumbJsonLd, buildMetadata, localeUrl } from "@/lib/seo";
import { getServiceArea, serviceAreas } from "@/lib/serviceAreas";
import { toLocale } from "@/i18n/routing";
import { SITE_URL } from "@/lib/constants";

export function generateStaticParams() {
  return serviceAreas.map((area) => ({ area: area.slug }));
}

// The previous schema labelled every area "…, Laval, QC", but four of the
// areas are Montreal boroughs. Keep the city correct per slug.
const MONTREAL_BOROUGH_SLUGS = new Set([
  "ahuntsic-cartierville",
  "montreal-nord",
  "saint-laurent",
  "lasalle",
]);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; area: string }>;
}) {
  const { lang, area: slug } = await params;
  const locale = toLocale(lang);
  const area = getServiceArea(slug);
  if (!area) {
    return buildMetadata({
      locale,
      title: locale === "fr" ? "Secteurs desservis" : "Service Areas",
      description:
        locale === "fr"
          ? "Les secteurs desservis par Renovision AnA à Laval et dans le grand Montréal."
          : "The areas Renovision AnA serves across Laval and greater Montreal.",
      path: "/service-areas",
    });
  }

  // Metadata in the language the page is served in. English metadata over
  // French content is what got these pages indexed with mismatched titles;
  // now each language has its own URL, so each gets its own half of the data.
  return buildMetadata({
    locale,
    title: area[locale].tagline,
    description: area[locale].metaDescription,
    path: `/service-areas/${area.slug}`,
  });
}

export default async function ServiceAreaPage({
  params,
}: {
  params: Promise<{ lang: string; area: string }>;
}) {
  const { lang, area: slug } = await params;
  const locale = toLocale(lang);
  const area = getServiceArea(slug);
  if (!area) notFound();

  // FAQPage schema for the area-specific Q&A, plus an explicit Service node
  // tied back to the single canonical business @id in LocalBusinessSchema —
  // so these read as one business serving many areas, not many businesses.
  // All strings come from the locale the page renders: Google requires FAQ
  // markup to match text visible on the page.
  const copy = area[locale];
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Service",
        name: copy.tagline,
        serviceType:
          locale === "fr"
            ? "Rénovation et restauration après dégât d'eau"
            : "Renovation and water damage restoration",
        provider: { "@id": `${SITE_URL}/#business` },
        areaServed: {
          "@type": "Place",
          name: `${copy.name}, ${MONTREAL_BOROUGH_SLUGS.has(area.slug) ? "Montréal" : "Laval"}, QC`,
        },
        url: localeUrl(locale, `/service-areas/${area.slug}`),
      },
      {
        "@type": "FAQPage",
        mainEntity: copy.faq.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: { "@type": "Answer", text: item.answer },
        })),
      },
      breadcrumbJsonLd(locale, [
        { name: HOME_LABEL[locale], path: "/" },
        {
          name: locale === "fr" ? "Secteurs desservis" : "Service Areas",
          path: "/service-areas",
        },
        { name: copy.name, path: `/service-areas/${area.slug}` },
      ]),
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ServiceAreaContent area={area} />
    </>
  );
}
