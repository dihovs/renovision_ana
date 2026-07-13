import type { Metadata } from "next";
import PlaceholderPage from "@/components/ui/PlaceholderPage";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Renovation tips, water damage prevention advice, and project stories from Renovision AnA.",
};

export default function BlogPage() {
  return (
    <PlaceholderPage
      title="Blog"
      description="Renovation tips, before & after project stories, and advice for property managers, insurers, and homeowners."
    />
  );
}
