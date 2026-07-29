import PaintingContent from "@/components/pages/PaintingContent";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Interior Painting",
  description:
    "Interior painting in Laval and Montreal — walls, ceilings, trim, baseboards, and doors, with priming on new drywall and colour changes quoted upfront.",
  path: "/services/painting",
});

export default function PaintingPage() {
  return <PaintingContent />;
}
