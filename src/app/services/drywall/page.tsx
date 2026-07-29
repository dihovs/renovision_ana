import DrywallContent from "@/components/pages/DrywallContent";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Drywall Installation & Finishing",
  description:
    "Drywall installation, taping, plastering, and repairs in Laval and Montreal — standard, fire-rated Type X, and moisture-resistant board finished ready to paint.",
  path: "/services/drywall",
});

export default function DrywallPage() {
  return <DrywallContent />;
}
