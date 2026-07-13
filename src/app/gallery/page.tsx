import type { Metadata } from "next";
import PlaceholderPage from "@/components/ui/PlaceholderPage";

export const metadata: Metadata = {
  title: "Gallery",
  description:
    "Browse completed renovation, water damage restoration, and kitchen & bathroom remodeling projects by Renovision Ana.",
};

export default function GalleryPage() {
  return (
    <PlaceholderPage
      title="Completed Projects"
      description="A look at recent renovation, restoration, and remodeling work from our team."
    />
  );
}
