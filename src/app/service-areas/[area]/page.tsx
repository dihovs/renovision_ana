import { notFound } from "next/navigation";
import ServiceAreaContent from "@/components/pages/ServiceAreaContent";
import { buildMetadata } from "@/lib/seo";
import { getServiceArea, serviceAreas } from "@/lib/serviceAreas";
import { SITE_URL } from "@/lib/constants";

export function generateStaticParams() {
  return serviceAreas.map((area) => ({ area: area.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ area: string }> }) {
  const { area: slug } = await params;
  const area = getServiceArea(slug);
  if (!area) {
    return buildMetadata({
      title: "Service Areas",
      description: "Areas served by Renovision AnA.",
      path: "/service-areas",
    });
  }

  return buildMetadata({
    title: area.en.tagline,
    description: area.en.metaDescription,
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
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Service",
        name: area.en.tagline,
        serviceType: "Renovation and water damage restoration",
        provider: { "@id": `${SITE_URL}/#business` },
        areaServed: {
          "@type": "Place",
          name: `${area.en.name}, Laval, QC`,
        },
        url: `${SITE_URL}/service-areas/${area.slug}`,
      },
      {
        "@type": "FAQPage",
        mainEntity: area.en.faq.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: { "@type": "Answer", text: item.answer },
        })),
      },
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
