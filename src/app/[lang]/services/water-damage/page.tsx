import WaterDamageContent from "@/components/pages/WaterDamageContent";
import { localizedMetadata, serviceJsonLd } from "@/lib/seo";
import { toLocale } from "@/i18n/routing";
import { WATER_DAMAGE_FAQ } from "@/lib/serviceFaq";

export const generateMetadata = localizedMetadata({
  path: "/services/water-damage",
  fr: {
    title: "Dégât d'eau et rénovation après sinistre à Laval",
    // « Répondu 24/7 » plutôt que « intervention 24/7 » : c'est la ligne qui
    // est répondue à toute heure. Placé en fin de description parce que c'est
    // l'argument qui décide un clic à 3h du matin.
    description:
      "Rénovation après sinistre à Laval et Montréal : extraction d'eau, séchage et remise en état après un dégât d'eau. Urgence répondue 24/7.",
  },
  en: {
    title: "Water Damage & Post-Disaster Restoration in Laval",
    description:
      "Water extraction, drying, and full post-disaster repair in Laval and Montreal. Documentation ready for your insurance claim — emergency line answered 24/7.",
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
        dangerouslySetInnerHTML={{
          // Same array the page renders — see serviceFaq.ts.
          __html: JSON.stringify(
            serviceJsonLd(locale, { ...schema, faq: WATER_DAMAGE_FAQ[locale] }),
          ),
        }}
      />
      <WaterDamageContent />
    </>
  );
}
