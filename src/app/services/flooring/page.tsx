import type { Metadata } from "next";
import PlaceholderPage from "@/components/ui/PlaceholderPage";

export const metadata: Metadata = {
  title: "Flooring",
  description:
    "Tile, hardwood, and vinyl flooring installation and refinishing from Renovision AnA.",
};

export default function FlooringPage() {
  return (
    <PlaceholderPage
      title="Flooring"
      description="Tile, hardwood, and vinyl flooring installed and refinished with precision — built to last and matched to your space."
    />
  );
}
