import CeilingWaterDamageContent from "@/components/pages/CeilingWaterDamageContent";
import { localizedMetadata, serviceJsonLd } from "@/lib/seo";
import { toLocale } from "@/i18n/routing";
import { CEILING_FAQ } from "@/lib/serviceFaq";

/**
 * Nested under /services/water-damage rather than sitting beside it, because
 * the hierarchy is true: this is the same restoration work narrowed to the one
 * surface people actually search for. The breadcrumb reads Accueil › Services ›
 * the page, which is the same trail the other service pages use.
 */
export const generateMetadata = localizedMetadata({
  path: "/services/water-damage/ceiling",
  fr: {
    title: "Dégât d'eau au plafond à Laval et Montréal",
    description:
      "Tache ou plafond gonflé après un dégât d'eau à Laval ou Montréal : quoi faire, qui paie, réparer ou remplacer. Urgence répondue 24/7.",
  },
  en: {
    title: "Ceiling Water Damage Repair in Laval",
    description:
      "Ceiling water damage in Laval and Montreal: what to do first, who pays, and whether it gets patched or replaced. Emergency line answered 24/7.",
  },
});

const schema = {
  path: "/services/water-damage/ceiling",
  fr: {
    name: "Réparation de plafond après dégât d'eau",
    serviceType: "Dégât d'eau au plafond",
    description:
      "Assèchement, réparation et remplacement de plafonds endommagés par l'eau à Laval et Montréal, avec relevés d'humidité et photos consignés pour la réclamation.",
  },
  en: {
    name: "Ceiling Water Damage Repair",
    serviceType: "Ceiling Water Damage",
    description:
      "Drying, repair, and replacement of water-damaged ceilings in Laval and Montreal, with moisture readings and photos documented for the insurance claim.",
  },
};

export default async function CeilingWaterDamagePage({
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
          __html: JSON.stringify(serviceJsonLd(locale, { ...schema, faq: CEILING_FAQ[locale] })),
        }}
      />
      <CeilingWaterDamageContent />
    </>
  );
}
