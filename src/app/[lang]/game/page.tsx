import MiniGameContent from "@/components/pages/MiniGameContent";
import { HOME_LABEL, breadcrumbJsonLd, localizedMetadata } from "@/lib/seo";
import { toLocale } from "@/i18n/routing";

// Slug is "game", not a translated word: every other route in this tree
// (case-studies, gallery, services...) shares one English-neutral slug across
// both locales rather than translating the path segment, so /en/game stays
// consistent with that pattern instead of reading oddly as /en/jeu.
export const generateMetadata = localizedMetadata({
  path: "/game",
  fr: {
    title: "60 secondes pour rester au sec — pouvez-vous battre l'eau?",
    description:
      "Colmatez les fuites avant que l'eau gagne. Un jeu d'arcade rapide signé l'équipe qui répare les dégâts d'eau pour vrai — puis obtenez une estimation gratuite.",
  },
  en: {
    title: "60 Seconds to Dry — Can You Beat the Water?",
    description:
      "Seal the leaks before the water wins. A quick arcade game from the water-damage crew who does this for real — then get a free estimate.",
  },
});

export default async function MiniGamePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const locale = toLocale((await params).lang);
  const jsonLd = breadcrumbJsonLd(locale, [
    { name: HOME_LABEL[locale], path: "/" },
    { name: locale === "fr" ? "Jeu" : "Game", path: "/game" },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <MiniGameContent />
    </>
  );
}
