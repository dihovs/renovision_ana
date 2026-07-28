import ServiceAreasIndexContent from "@/components/pages/ServiceAreasIndexContent";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Service Areas in Laval & Greater Montreal",
  description:
    "The Laval sectors Renovision AnA works in most — Chomedey, Sainte-Rose, Vimont, Fabreville, and Duvernay — and what each area's housing stock means for renovation and water damage work.",
  path: "/service-areas",
});

export default function ServiceAreasPage() {
  return <ServiceAreasIndexContent />;
}
