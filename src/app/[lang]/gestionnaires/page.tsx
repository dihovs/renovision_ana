import GestionnairesContent from "@/components/pages/GestionnairesContent";
import { localizedMetadata } from "@/lib/seo";

export const generateMetadata = localizedMetadata({
  path: "/gestionnaires",
  fr: {
    title: "Solution fiable pour gestionnaires immobiliers — Dégât d'eau et rénovation à Laval et Montréal",
    description:
      "Intervention d'urgence après dégât d'eau pour gestionnaires immobiliers : extraction, séchage, reconstruction. Un seul appel, un seul coordonnateur, documentation prête pour l'assureur. Ligne répondue 24/7 à Laval et Montréal.",
  },
  en: {
    title: "Reliable Partner for Property Managers — Water Damage & Renovation in Laval & Montreal",
    description:
      "Emergency water damage response for property managers: extraction, drying, reconstruction. One call, one coordinator, insurer-ready documentation. Line answered 24/7 in Laval and Montreal.",
  },
});

export default function GestionnairesPage() {
  return <GestionnairesContent />;
}