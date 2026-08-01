import CaseStudiesContent from "@/components/pages/CaseStudiesContent";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Études de cas — projets avant-après",
  description:
    "Projets Renovision AnA décortiqués : le problème constaté, la solution livrée et le résultat pour le client, avec photos avant-après à l'appui.",
  path: "/case-studies",
});

export default function CaseStudiesPage() {
  return <CaseStudiesContent />;
}
