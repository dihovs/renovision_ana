import EstimatorContent from "@/components/pages/EstimatorContent";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Estimation de rénovation en ligne gratuite | Laval & Montréal",
  description:
    "Obtenez en quelques minutes une fourchette de prix détaillée pour votre rénovation ou dégât d'eau à Laval : chaque poste chiffré, sans engagement.",
  path: "/estimation",
});

export default function EstimationPage() {
  return <EstimatorContent />;
}
