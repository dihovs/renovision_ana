import BlogContent from "@/components/pages/BlogContent";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Blog",
  description:
    "Renovation tips, water damage prevention advice, and project stories from Renovision AnA.",
  path: "/blog",
});

export default function BlogPage() {
  return <BlogContent />;
}
