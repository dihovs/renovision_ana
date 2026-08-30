import EstimatorContent from "@/components/pages/EstimatorContent";
import { HOME_LABEL, breadcrumbJsonLd, localizedMetadata } from "@/lib/seo";
import { estimatorFaqEn, estimatorFaqFr } from "@/lib/estimatorFaq";
import { toLocale } from "@/i18n/routing";

// This page has never had English metadata — it was added French-only — so the
// English title and description here are the page's own English H1 and intro,
// verbatim. Worth a purpose-written English meta description from the owner.
export const generateMetadata = localizedMetadata({
  path: "/estimation",
  fr: {
    title: "Combien coûte votre rénovation à Laval?",
    description:
      "Estimation gratuite et détaillée pour cuisine, salle de bain, sous-sol, planchers ou dégât d'eau à Laval et Montréal — un prix par poste, en quelques minutes.",
  },
  en: {
    title: "What Will Your Renovation Cost? Free Estimate in Minutes",
    description:
      "Price your renovation line by line — materials, labour, travel — from the price list our crews work from. A detailed range in minutes, no forms, no waiting.",
  },
});

// FAQPage schema built from the same arrays EstimatorContent renders, in the
// language the page is served in. A past bug on the service-area pages came
// from building FAQ schema off English copy while French was what Google
// actually indexed; now that English has its own URL, each side needs its own
// markup. See src/app/[lang]/service-areas/[area]/page.tsx for the pattern
// this mirrors.
const FAQ = { fr: estimatorFaqFr, en: estimatorFaqEn };

export default async function EstimationPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const locale = toLocale((await params).lang);
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "FAQPage",
        mainEntity: FAQ[locale].map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: { "@type": "Answer", text: item.a },
        })),
      },
      breadcrumbJsonLd(locale, [
        { name: HOME_LABEL[locale], path: "/" },
        { name: locale === "fr" ? "Estimation" : "Free Estimate", path: "/estimation" },
      ]),
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <EstimatorContent />
    </>
  );
}
