import { notFound } from "next/navigation";
import ServiceAreaContent from "@/components/pages/ServiceAreaContent";
import { breadcrumbJsonLd, buildMetadata } from "@/lib/seo";
import { getServiceArea, serviceAreas } from "@/lib/serviceAreas";
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

export async function generateMetadata({ params }: { params: Promise<{ area: string }> }) {
  const { area: slug } = await params;
  const area = getServiceArea(slug);
  if (!area) {
    return buildMetadata({
      title: "Secteurs desservis",
      description: "Les secteurs desservis par Renovision AnA à Laval et dans le grand Montréal.",
      path: "/service-areas",
    });
  }

  // French metadata to match the French page the crawler actually receives
  // (SSR default is fr) — English metadata over French content is what got
  // these pages indexed with mismatched titles.
  return buildMetadata({
    title: area.fr.tagline,
    description: area.fr.metaDescription,
    path: `/service-areas/${area.slug}`,
  });
}

export default async function ServiceAreaPage({ params }: { params: Promise<{ area: string }> }) {
  const { area: slug } = await params;
  const area = getServiceArea(slug);
  if (!area) notFound();

  // FAQPage schema for the area-specific Q&A, plus an explicit Service node
  // tied back to the single canonical business @id in LocalBusinessSchema —
  // so these read as one business serving many areas, not many businesses.
  // All strings come from `area.fr`: Google requires FAQ markup to match text
  // visible on the page, and the served page is French.
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Service",
        name: area.fr.tagline,
        serviceType: "Rénovation et restauration après dégât d'eau",
        provider: { "@id": `${SITE_URL}/#business` },
        areaServed: {
          "@type": "Place",
          name: `${area.fr.name}, ${MONTREAL_BOROUGH_SLUGS.has(area.slug) ? "Montréal" : "Laval"}, QC`,
        },
        url: `${SITE_URL}/service-areas/${area.slug}`,
      },
      {
        "@type": "FAQPage",
        mainEntity: area.fr.faq.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: { "@type": "Answer", text: item.answer },
        })),
      },
      breadcrumbJsonLd([
        { name: "Accueil", path: "/" },
        { name: "Secteurs desservis", path: "/service-areas" },
        { name: area.fr.name, path: `/service-areas/${area.slug}` },
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
