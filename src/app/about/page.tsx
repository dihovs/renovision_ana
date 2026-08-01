import AboutContent from "@/components/pages/AboutContent";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "À propos — entrepreneur en rénovation à Laval",
  description:
    "Découvrez Renovision AnA : une équipe de rénovation et de restauration après dégât d'eau au service de Laval et du grand Montréal. Parlez-nous de votre projet.",
  path: "/about",
});

export default function AboutPage() {
  return <AboutContent />;
}
