import EstimatorContent from "@/components/pages/EstimatorContent";
import { breadcrumbJsonLd, buildMetadata } from "@/lib/seo";
import { estimatorFaqFr } from "@/lib/estimatorFaq";

export const metadata = buildMetadata({
  title: "Combien coûte votre rénovation à Laval? Estimation en ligne gratuite",
  description:
    "Estimation gratuite et détaillée pour cuisine, salle de bain, sous-sol, planchers ou dégât d'eau à Laval et Montréal — un prix par poste, en quelques minutes.",
  path: "/estimation",
});

// FAQPage schema built from estimatorFaqFr — the exact French strings
// EstimatorContent renders, since French is this app's served default
// locale. A past bug on the service-area pages came from building FAQ
// schema off English copy while French was what Google actually indexed;
// see src/app/service-areas/[area]/page.tsx for the pattern this mirrors.
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "FAQPage",
      mainEntity: estimatorFaqFr.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
      })),
    },
    breadcrumbJsonLd([
      { name: "Accueil", path: "/" },
      { name: "Estimation", path: "/estimation" },
    ]),
  ],
};

export default function EstimationPage() {
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
