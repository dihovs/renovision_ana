import CareersContent from "@/components/pages/CareersContent";
import { localizedMetadata } from "@/lib/seo";

export const generateMetadata = localizedMetadata({
  path: "/careers",
  fr: {
    title: "Carrières en rénovation à Laval",
    description:
      "Joignez-vous à l'équipe Renovision AnA : menuisiers, poseurs de planchers, peintres, tireurs de joints et apprentis. Postulez dès aujourd'hui à Laval.",
  },
  en: {
    title: "Careers",
    description:
      "Join the Renovision AnA team. We're hiring renovation carpenters, flooring installers, painters, drywall finishers, and apprentices.",
  },
});

export default function CareersPage() {
  return <CareersContent />;
}
