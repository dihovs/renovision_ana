import type { Metadata } from "next";
import PlaceholderPage from "@/components/ui/PlaceholderPage";

export const metadata: Metadata = {
  title: "Basement Transformations",
  description:
    "Full basement transformations from unfinished space to beautiful, livable rooms by Renovision AnA.",
};

export default function BasementsPage() {
  return (
    <PlaceholderPage
      title="Basement Transformations"
      description="Full basement transformations — from unfinished space to beautiful, livable rooms your family will actually use."
    />
  );
}
