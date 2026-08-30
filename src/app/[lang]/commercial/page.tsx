import CommercialContent from "@/components/pages/CommercialContent";
import { localizedMetadata } from "@/lib/seo";

export const generateMetadata = localizedMetadata({
  path: "/commercial",
  fr: {
    title: "Rénovation pour gestionnaires immobiliers",
    description:
      "Remise en état rapide de logements, un seul point de contact, documentation prête pour l'assureur et réponse aux dégâts d'eau 7 jours sur 7 à Laval et Montréal.",
  },
  en: {
    title: "Renovations for Property Managers in Laval & Montreal",
    description:
      "Renovation partner for property managers in Laval and Montreal: fast unit turnovers, one contact for all trades, insurer-ready documentation, 7-day response.",
  },
});

export default function CommercialPage() {
  return <CommercialContent />;
}
