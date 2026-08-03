import WaterDamageContent from "@/components/pages/WaterDamageContent";
import { localizedMetadata, serviceJsonLd } from "@/lib/seo";
import { toLocale } from "@/i18n/routing";

export const generateMetadata = localizedMetadata({
  path: "/services/water-damage",
  fr: {
    title: "Restauration après dégât d'eau à Laval et Montréal",
    description:
      "Extraction d'eau, séchage et remise en état après un dégât d'eau à Laval et Montréal. Intervention rapide 7 jours sur 7 — appelez pour une soumission gratuite.",
  },
  en: {
    title: "Water Damage Restoration",
    description:
      "Rapid response water extraction, drying, and repair services from Renovision AnA.",
  },
});

// Service schema tied to the single canonical business @id (same pattern as
// the service-area pages), plus a breadcrumb trail in the language the page
// is actually served in — Google expects markup to match visible copy.
const schema = {
  path: "/services/water-damage",
  fr: {
    name: "Restauration après dégât d'eau",
    serviceType: "Restauration après dégât d'eau",
    description:
      "Extraction d'eau, séchage, assèchement et remise en état complète après un dégât d'eau, pour propriétaires, gestionnaires immobiliers et assureurs.",
  },
  en: {
    name: "Water Damage Restoration",
    serviceType: "Water Damage Restoration",
    description:
      "Rapid response water extraction, drying, and repair to protect your property and minimize downtime.",
  },
};

export default async function WaterDamagePage({
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
      <WaterDamageContent />
    </>
  );
}
