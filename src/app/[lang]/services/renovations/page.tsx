import RenovationsContent from "@/components/pages/RenovationsContent";
import { localizedMetadata, serviceJsonLd } from "@/lib/seo";
import { toLocale } from "@/i18n/routing";

export const generateMetadata = localizedMetadata({
  path: "/services/renovations",
  fr: {
    title: "Rénovation intérieure à Laval et Montréal",
    description:
      "Rénovation intérieure complète à Laval et Montréal : chambres, salons, bureaux et aires ouvertes. Travail clé en main — demandez votre soumission gratuite.",
  },
  en: {
    title: "Interior Renovations",
    description:
      "Complete interior renovations for any room — bedrooms, living rooms, offices — from Renovision AnA.",
  },
});

// Service schema tied to the single canonical business @id (same pattern as
// the service-area pages), plus a breadcrumb trail in the page's language.
const schema = {
  path: "/services/renovations",
  fr: {
    name: "Rénovation intérieure",
    serviceType: "Rénovation intérieure",
    description:
      "Rénovation complète de pièces et d'espaces intérieurs — chambres, salons, bureaux — de la planification à la finition.",
  },
  en: {
    name: "Interior Renovations",
    serviceType: "Interior Renovations",
    description:
      "Bedrooms, living rooms, offices — complete renovations for any room and any interior space.",
  },
};

export default async function RenovationsPage({
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
      <RenovationsContent />
    </>
  );
}
