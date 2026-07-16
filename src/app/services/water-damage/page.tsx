import WaterDamageContent from "@/components/pages/WaterDamageContent";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Water Damage Restoration",
  description:
    "Rapid response water extraction, drying, and repair services from Renovision AnA.",
  path: "/services/water-damage",
});

export default function WaterDamagePage() {
  return <WaterDamageContent />;
}
