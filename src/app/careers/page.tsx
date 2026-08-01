import CareersContent from "@/components/pages/CareersContent";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Carrières en rénovation à Laval",
  description:
    "Joignez-vous à l'équipe Renovision AnA : menuisiers, poseurs de planchers, peintres, tireurs de joints et apprentis. Postulez dès aujourd'hui à Laval.",
  path: "/careers",
});

export default function CareersPage() {
  return <CareersContent />;
}
