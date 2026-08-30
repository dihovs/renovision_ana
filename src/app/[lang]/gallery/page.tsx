import GalleryContent from "@/components/pages/GalleryContent";
import { localizedMetadata } from "@/lib/seo";

export const generateMetadata = localizedMetadata({
  path: "/gallery",
  fr: {
    title: "Galerie de projets — Laval et Montréal",
    description:
      "Parcourez nos projets réalisés : rénovations, restaurations après dégât d'eau et sous-sols transformés à Laval et Montréal. Photos avant-après à l'appui.",
  },
  en: {
    title: "Gallery",
    description:
      "Browse completed renovation, water damage restoration, and basement transformation projects by Renovision AnA.",
  },
});

export default function GalleryPage() {
  return <GalleryContent />;
}
