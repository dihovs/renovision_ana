import AssureursContent from "@/components/pages/AssureursContent";
import { localizedMetadata, breadcrumbJsonLd, HOME_LABEL } from "@/lib/seo";
import { toLocale } from "@/i18n/routing";

export const generateMetadata = localizedMetadata({
  path: "/assureurs",
  fr: {
    title: "Entrepreneur pour assureurs — Laval et Montréal",
    description:
      "Portée écrite, documentation photo complète, journal de séchage et facturation directe pour les réclamations dégât d'eau au Québec. Réduisez le temps de traitement de vos dossiers.",
  },
  en: {
    title: "Contractor for Insurance Companies — Laval & Montreal",
    description:
      "Written scope, full photo documentation, drying logs, and direct billing for water damage claims in Quebec. Reduce your claim cycle time.",
  },
});

export default async function AssureursPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const locale = toLocale((await params).lang);
  const jsonLd = breadcrumbJsonLd(locale, [
    { name: HOME_LABEL[locale], path: "/" },
    {
      name: locale === "fr" ? "Assureurs" : "Insurance Companies",
      path: "/assureurs",
    },
  ]);
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <AssureursContent />
    </>
  );
}