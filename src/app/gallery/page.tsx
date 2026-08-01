import GalleryContent from "@/components/pages/GalleryContent";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Galerie de projets de rénovation à Laval et Montréal",
  description:
    "Parcourez nos projets réalisés : rénovations, restaurations après dégât d'eau et sous-sols transformés à Laval et Montréal. Photos avant-après à l'appui.",
  path: "/gallery",
});

export default function GalleryPage() {
  return <GalleryContent />;
}
