import CommercialContent from "@/components/pages/CommercialContent";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Renovation & Restoration for Property Managers | Laval & Montreal",
  description:
    "Property management renovation partner in Laval and greater Montreal: fast unit turnovers, one point of contact for all trades, insurer-ready documentation, and 7-day-a-week water damage response for occupied buildings.",
  path: "/commercial",
});

export default function CommercialPage() {
  return <CommercialContent />;
}
