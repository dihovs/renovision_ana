import ServiceAreasIndexContent from "@/components/pages/ServiceAreasIndexContent";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Secteurs desservis à Laval et Montréal",
  description:
    "Les secteurs où Renovision AnA travaille le plus — Chomedey, Sainte-Rose, Vimont, Fabreville, Duvernay et quatre arrondissements de Montréal. Découvrez-les.",
  path: "/service-areas",
});

export default function ServiceAreasPage() {
  return <ServiceAreasIndexContent />;
}
