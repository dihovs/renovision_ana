import RepairsContent from "@/components/pages/RepairsContent";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Small Repairs & Color Matching",
  description:
    "Cost-effective local repairs with precise color matching from Renovision AnA.",
  path: "/services/repairs",
});

export default function RepairsPage() {
  return <RepairsContent />;
}
