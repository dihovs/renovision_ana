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
      "The sectors Renovision AnA serves most — Chomedey, Sainte-Rose, Vimont, Fabreville, Duvernay and more — and what each one's housing stock means for our work.",
  },
});

export default function ServiceAreasPage() {
  return <ServiceAreasIndexContent />;
}
