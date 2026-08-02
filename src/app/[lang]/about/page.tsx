import AboutContent from "@/components/pages/AboutContent";
import { localizedMetadata } from "@/lib/seo";

export const generateMetadata = localizedMetadata({
  path: "/about",
  fr: {
    title: "À propos — entrepreneur en rénovation à Laval",
    description:
      "Découvrez Renovision AnA : une équipe de rénovation et de restauration après dégât d'eau au service de Laval et du grand Montréal. Parlez-nous de votre projet.",
  },
  en: {
    title: "About Us",
    description:
      "Learn about Renovision AnA, our team, and our commitment to quality renovation and water damage restoration work in Laval and greater Montreal.",
  },
});

export default function AboutPage() {
  return <AboutContent />;
}
