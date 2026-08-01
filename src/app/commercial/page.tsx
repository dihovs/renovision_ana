import CommercialContent from "@/components/pages/CommercialContent";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Rénovation pour gestionnaires immobiliers",
  description:
    "Remise en état rapide de logements, un seul point de contact, documentation prête pour l'assureur et réponse aux dégâts d'eau 7 jours sur 7 à Laval et Montréal.",
  path: "/commercial",
});

export default function CommercialPage() {
  return <CommercialContent />;
}
