import AssureursContent from "@/components/pages/AssureursContent";
import { localizedMetadata, breadcrumbJsonLd, HOME_LABEL } from "@/lib/seo";
import { toLocale } from "@/i18n/routing";

export const generateMetadata = localizedMetadata({
  path: "/assureurs",
  fr: {
    title: "Entrepreneur pour assureurs — Laval et Montréal",
    description:
      "Restauration après dégât d'eau pour assureurs : portée écrite, documentation photo complète, journal de séchage et facturation directe pour les réclamations au Québec. Réduisez le temps de traitement de vos dossiers.",
  },
  en: {
    title: "Contractor for Insurance Companies — Water Damage Restoration in Laval & Montreal",
    description:
      "Water damage restoration for insurance companies: written scope, full photo documentation, drying logs, and direct billing for claims in Quebec. Reduce your claim cycle time.",
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: [
              {
                "@type": "Question",
                name: "What documentation do you provide for insurance claims?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "Written scope before work starts, dated photo documentation from day one through completion, daily moisture readings and drying logs, and itemised invoicing per line of scope. Every piece is formatted for adjuster review without follow-up calls.",
                },
              },
              {
                "@type": "Question",
                name: "Do you work with Xactimate or Symbility?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "We regularly work within claims processes using scopes and documentation compatible with Xactimate, Symbility, and other adjuster platforms. Our invoices are itemised per line and formatted for direct processing.",
                },
              },
              {
                "@type": "Question",
                name: "Can you bill the insurance company directly?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "Yes. We provide direct billing to the insurer with itemised invoicing formatted for adjuster review. No lump-sum surprises that trigger a hold-and-verify cycle.",
                },
              },
              {
                "@type": "Question",
                name: "How fast can you respond to a water damage claim?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "Our line is answered 24/7. We arrive with a camera, a moisture meter, and a scope template. The file comes back the way your system expects it.",
                },
              },
            ],
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: [
              {
                "@type": "Question",
                name: "Quelle documentation fournissez-vous pour les réclamations d'assurance ?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "Portée écrite avant le début des travaux, documentation photo horodatée du premier jour à la fin, relevés d'humidité quotidiens et facturation détaillée poste par poste. Chaque élément est formaté pour la révision par l'expert sans appel de suivi.",
                },
              },
              {
                "@type": "Question",
                name: "Travaillez-vous avec Xactimate ou Symbility ?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "Nous travaillons régulièrement avec des portées et une documentation compatibles avec Xactimate, Symbility et autres plateformes d'experts. Nos factures sont détaillées poste par poste et formatées pour un traitement direct.",
                },
              },
              {
                "@type": "Question",
                name: "Pouvez-vous facturer la compagnie d'assurance directement ?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "Oui. Nous offrons la facturation directe à l'assureur avec une facturation détaillée formatée pour la révision par l'expert. Pas de surprises globales qui déclenchent un cycle d'attente.",
                },
              },
              {
                "@type": "Question",
                name: "Quel est votre délai d'intervention pour un dégât d'eau ?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "Notre ligne est répondue 24/7. Nous arrivons avec un appareil photo, un humidimètre et un modèle de portée écrite. Le dossier revient comme votre système l'attend.",
                },
              },
            ],
          }),
        }}
      />
      <AssureursContent />
    </>
  );
}