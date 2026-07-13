import type { Metadata } from "next";
import PlaceholderPage from "@/components/ui/PlaceholderPage";

export const metadata: Metadata = {
  title: "Renovations",
  description:
    "General renovation services for residential and commercial properties from Renovision Ana.",
};

export default function RenovationsPage() {
  return (
    <PlaceholderPage
      title="Renovations"
      description="Full and partial renovations for residential and commercial properties, from single rooms to entire units."
    />
  );
}
