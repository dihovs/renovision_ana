import SyndicatsContent from "@/components/pages/SyndicatsContent";
import { localizedMetadata, breadcrumbJsonLd, HOME_LABEL } from "@/lib/seo";
import { toLocale } from "@/i18n/routing";

/**
 * The route stays `/syndicats` in both languages, like every other path on the
 * site — routing serves both locales from one path, so an English reader lands
 * on /en/syndicats. "Syndicate" is the term Quebec English uses for this anyway.
 */
export const generateMetadata = localizedMetadata({
  path: "/syndicats",
  fr: {
    title: "Entrepreneur pour syndicats de copropriété",
    description:
      "Remise en état après dégât d'eau pour syndicats de copropriété à Laval et Montréal : portée écrite, documentation photo, facturation que votre assureur peut traiter.",
  },
  en: {
    title: "Contractor for Condo Syndicates",
    description:
      "Post-loss restoration for condo syndicates in Laval and Montreal: written scope, photo documentation, and invoicing your insurer can process.",
  },
});

export default async function SyndicatsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const locale = toLocale((await params).lang);
  const jsonLd = breadcrumbJsonLd(locale, [
    { name: HOME_LABEL[locale], path: "/" },
    {
      name: locale === "fr" ? "Syndicats de copropriété" : "Condo Syndicates",
      path: "/syndicats",
    },
  ]);
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SyndicatsContent />
    </>
  );
}
