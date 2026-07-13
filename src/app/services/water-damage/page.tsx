import type { Metadata } from "next";
import PlaceholderPage from "@/components/ui/PlaceholderPage";

export const metadata: Metadata = {
  title: "Water Damage Restoration",
  description:
    "Rapid response water extraction, drying, and repair services from Renovision AnA.",
};

export default function WaterDamagePage() {
  return (
    <PlaceholderPage
      title="Water Damage Restoration"
      description="Rapid response water extraction, drying, and repair to protect your property and minimize downtime."
    />
  );
}
