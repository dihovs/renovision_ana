import type { Metadata } from "next";
import PlaceholderPage from "@/components/ui/PlaceholderPage";

export const metadata: Metadata = {
  title: "Kitchen & Bath Remodeling",
  description:
    "Modern, functional kitchen and bathroom remodels tailored to your budget and style, by Renovision Ana.",
};

export default function KitchenBathPage() {
  return (
    <PlaceholderPage
      title="Kitchen & Bath Remodeling"
      description="Modern, functional kitchen and bathroom remodels tailored to your budget and style."
    />
  );
}
