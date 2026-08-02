import ServiceAreasIndexContent from "@/components/pages/ServiceAreasIndexContent";
import { localizedMetadata } from "@/lib/seo";

export const generateMetadata = localizedMetadata({
  path: "/service-areas",
  fr: {
    title: "Secteurs desservis à Laval et Montréal",
    description:
      "Les secteurs où Renovision AnA travaille le plus — Chomedey, Sainte-Rose, Vimont, Fabreville, Duvernay et quatre arrondissements de Montréal. Découvrez-les.",
  },
  en: {
    title: "Service Areas in Laval & Greater Montreal",
    description:
      "The Laval sectors Renovision AnA works in most — Chomedey, Sainte-Rose, Vimont, Fabreville, and Duvernay — and what each area's housing stock means for renovation and water damage work.",
  },
});

export default function ServiceAreasPage() {
  return <ServiceAreasIndexContent />;
}
