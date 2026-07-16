import GalleryContent from "@/components/pages/GalleryContent";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Gallery",
  description:
    "Browse completed renovation, water damage restoration, and basement transformation projects by Renovision AnA.",
  path: "/gallery",
});

export default function GalleryPage() {
  return <GalleryContent />;
}
