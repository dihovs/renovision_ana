import CaseStudiesContent from "@/components/pages/CaseStudiesContent";
import { localizedMetadata } from "@/lib/seo";

export const generateMetadata = localizedMetadata({
  path: "/case-studies",
  fr: {
    title: "Études de cas — projets avant-après",
    description:
      "Projets Renovision AnA décortiqués : le problème constaté, la solution livrée et le résultat pour le client, avec photos avant-après à l'appui.",
  },
  en: {
    title: "Featured Project Case Studies",
    description:
      "Before/after project breakdowns from Renovision AnA: the problem we found, the solution we delivered, and the result for the client.",
  },
});

export default function CaseStudiesPage() {
  return <CaseStudiesContent />;
}
