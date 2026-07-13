import type { Metadata } from "next";
import PlaceholderPage from "@/components/ui/PlaceholderPage";

export const metadata: Metadata = {
  title: "About Us",
  description:
    "Learn about Renovision AnA, our team, and our commitment to quality renovation and water damage restoration work.",
};

export default function AboutPage() {
  return (
    <PlaceholderPage
      title="About Renovision AnA"
      description="Our story, our team, and why property managers, insurers, and homeowners trust us with their projects."
    />
  );
}
