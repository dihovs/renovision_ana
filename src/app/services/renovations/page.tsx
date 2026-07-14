import type { Metadata } from "next";
import PlaceholderPage from "@/components/ui/PlaceholderPage";

export const metadata: Metadata = {
  title: "Interior Renovations",
  description:
    "Complete interior renovations for any room — bedrooms, living rooms, offices — from Renovision AnA.",
};

export default function RenovationsPage() {
  return (
    <PlaceholderPage
      title="Interior Renovations"
      description="Bedrooms, living rooms, offices — complete renovations for any room and any interior space, residential or commercial."
    />
  );
}
