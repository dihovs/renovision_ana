import BlogContent from "@/components/pages/BlogContent";
import { localizedMetadata } from "@/lib/seo";

export const generateMetadata = localizedMetadata({
  path: "/blog",
  fr: {
    title: "Blogue — conseils rénovation et dégât d'eau",
    description:
      "Conseils de rénovation, prévention des dégâts d'eau et histoires de projets par l'équipe Renovision AnA, au service de Laval et du grand Montréal.",
  },
  en: {
    title: "Blog",
    description:
      "Renovation tips, water damage prevention advice, and project stories from Renovision AnA.",
  },
});

export default function BlogPage() {
  return <BlogContent />;
}
