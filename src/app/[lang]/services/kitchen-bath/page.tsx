import KitchenBathContent from "@/components/pages/KitchenBathContent";
import { localizedMetadata, serviceJsonLd } from "@/lib/seo";
import { toLocale } from "@/i18n/routing";

export const generateMetadata = localizedMetadata({
  path: "/services/kitchen-bath",
  fr: {
    title: "Rénovation de cuisine et salle de bain à Laval et Montréal",
    description:
      "Cuisines et salles de bain modernes et fonctionnelles, rénovées selon votre budget et votre style à Laval et Montréal. Demandez votre soumission gratuite.",
  },
  en: {
    title: "Kitchen & Bath Remodeling",
    description:
      "Modern, functional kitchen and bathroom remodels tailored to your budget and style, by Renovision AnA.",
  },
});

// Service schema tied to the single canonical business @id (same pattern as
// the service-area pages), plus a breadcrumb trail in the page's language.
const schema = {
  path: "/services/kitchen-bath",
  fr: {
    name: "Rénovation de cuisine et salle de bain",
    serviceType: "Rénovation de cuisine et de salle de bain",
    description:
      "Réfection complète de cuisines et de salles de bain : armoires, comptoirs, céramique, plomberie de finition et éclairage.",
  },
  en: {
    name: "Kitchens & Bathrooms",
    serviceType: "Kitchen & Bath Remodeling",
    description:
      "Modern, functional kitchen and bathroom remodels tailored to your budget and style.",
  },
};

export default async function KitchenBathPage({
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
      <KitchenBathContent />
    </>
  );
}
