import CaseStudiesContent from "@/components/pages/CaseStudiesContent";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Featured Project Case Studies",
  description:
    "Before/after project breakdowns from Renovision AnA: the problem we found, the solution we delivered, and the result for the client.",
  path: "/case-studies",
});

export default function CaseStudiesPage() {
  return <CaseStudiesContent />;
}
