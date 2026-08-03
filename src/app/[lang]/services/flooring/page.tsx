import FlooringContent from "@/components/pages/FlooringContent";
import { localizedMetadata, serviceJsonLd } from "@/lib/seo";
import { toLocale } from "@/i18n/routing";

export const generateMetadata = localizedMetadata({
  path: "/services/flooring",
  fr: {
    title: "Pose de planchers à Laval et Montréal",
    description:
      "Pose de planchers de bois franc, de vinyle et de céramique à Laval et Montréal. Installation précise, finition soignée — demandez votre soumission gratuite.",
  },
  en: {
    title: "Flooring",
    description:
      "Tile, hardwood, and vinyl flooring installation and refinishing from Renovision AnA.",
  },
});

// Service schema tied to the single canonical business @id (same pattern as
// the service-area pages), plus a breadcrumb trail in the page's language.
const schema = {
  path: "/services/flooring",
  fr: {
    name: "Pose de planchers",
    serviceType: "Pose de revêtements de sol",
    description:
      "Installation de planchers de bois franc, de vinyle et de céramique, avec préparation du support et finition soignée.",
  },
  en: {
    name: "Flooring",
    serviceType: "Flooring",
    description:
      "Tile, hardwood, and vinyl flooring installed and refinished with precision, built to last.",
  },
};

export default async function FlooringPage({
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
      <FlooringContent />
    </>
  );
}
