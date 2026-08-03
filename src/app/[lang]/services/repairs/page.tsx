import RepairsContent from "@/components/pages/RepairsContent";
import { localizedMetadata, serviceJsonLd } from "@/lib/seo";
import { toLocale } from "@/i18n/routing";

export const generateMetadata = localizedMetadata({
  path: "/services/repairs",
  fr: {
    title: "Petites réparations à Laval et Montréal",
    description:
      "Petites réparations économiques avec agencement de couleurs précis à Laval et Montréal — résultat invisible, sans refaire toute la pièce. Soumission gratuite.",
  },
  en: {
    title: "Small Repairs & Color Matching",
    description:
      "Cost-effective local repairs with precise color matching from Renovision AnA.",
  },
});

// Service schema tied to the single canonical business @id (same pattern as
// the service-area pages), plus a breadcrumb trail in the page's language.
const schema = {
  path: "/services/repairs",
  fr: {
    name: "Petites réparations et agencement de couleurs",
    serviceType: "Réparations et retouches intérieures",
    description:
      "Réparations locales économiques avec agencement de couleurs précis, pour corriger les dommages sans refaire toute la pièce.",
  },
  en: {
    name: "Small Repairs & Color Matching",
    serviceType: "Small Repairs & Color Matching",
    description:
      "Cost-effective local repairs with precise color matching that blends seamlessly into the existing finish.",
  },
};

export default async function RepairsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const locale = toLocale((await params).lang);
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd(locale, schema)) }}
      />
      <RepairsContent />
    </>
  );
}
