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
    title: "Renovation & Restoration for Property Managers | Laval & Montreal",
    description:
      "Property management renovation partner in Laval and greater Montreal: fast unit turnovers, one point of contact for all trades, insurer-ready documentation, and 7-day-a-week water damage response for occupied buildings.",
  },
});

export default function CommercialPage() {
  return <CommercialContent />;
}
