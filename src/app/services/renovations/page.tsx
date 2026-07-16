import RenovationsContent from "@/components/pages/RenovationsContent";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Interior Renovations",
  description:
    "Complete interior renovations for any room — bedrooms, living rooms, offices — from Renovision AnA.",
  path: "/services/renovations",
});

export default function RenovationsPage() {
  return <RenovationsContent />;
}
