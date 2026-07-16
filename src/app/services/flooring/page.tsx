import FlooringContent from "@/components/pages/FlooringContent";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Flooring",
  description:
    "Tile, hardwood, and vinyl flooring installation and refinishing from Renovision AnA.",
  path: "/services/flooring",
});

export default function FlooringPage() {
  return <FlooringContent />;
}
