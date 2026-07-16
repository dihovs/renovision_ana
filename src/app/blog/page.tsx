import PlaceholderPage from "@/components/ui/PlaceholderPage";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Blog",
  description:
    "Renovation tips, water damage prevention advice, and project stories from Renovision AnA.",
  path: "/blog",
});

export default function BlogPage() {
  return (
    <PlaceholderPage
      title="Blog"
      description="Renovation tips, before & after project stories, and advice for property managers, insurers, and homeowners."
    />
  );
}
