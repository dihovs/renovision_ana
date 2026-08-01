import BlogContent from "@/components/pages/BlogContent";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Blogue — conseils rénovation et dégât d'eau",
  description:
    "Conseils de rénovation, prévention des dégâts d'eau et histoires de projets par l'équipe Renovision AnA, au service de Laval et du grand Montréal.",
  path: "/blog",
});

export default function BlogPage() {
  return <BlogContent />;
}
