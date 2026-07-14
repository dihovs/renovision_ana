import type { Metadata } from "next";
import PlaceholderPage from "@/components/ui/PlaceholderPage";

export const metadata: Metadata = {
  title: "Small Repairs & Color Matching",
  description:
    "Cost-effective local repairs with precise color matching from Renovision AnA.",
};

export default function RepairsPage() {
  return (
    <PlaceholderPage
      title="Small Repairs & Color Matching"
      description="Cost-effective local repairs with precise color matching that blends seamlessly into the existing finish — no need to redo the whole wall."
    />
  );
}
