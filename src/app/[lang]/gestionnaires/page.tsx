import GestionnairesContent from "@/components/pages/GestionnairesContent";
import { localizedMetadata, breadcrumbJsonLd, HOME_LABEL } from "@/lib/seo";
import { toLocale } from "@/i18n/routing";

export const generateMetadata = localizedMetadata({
  path: "/gestionnaires",
  fr: {
    title: "Solution fiable pour gestionnaires immobiliers — Restauration après dégât d'eau et rénovation à Laval et Montréal",
    description:
      "Restauration après dégât d'eau pour gestionnaires immobiliers : extraction, séchage, reconstruction. Un seul appel, un seul coordonnateur, documentation prête pour l'assureur. Ligne répondue 24/7 à Laval et Montréal.",
  },
  en: {
    title: "Reliable Partner for Property Managers — Water Damage & Renovation in Laval & Montreal",
    description:
      "Water damage restoration for property managers: extraction, drying, reconstruction. One call, one coordinator, insurer-ready documentation. Line answered 24/7 in Laval and Montreal.",
  },
});

export default async function GestionnairesPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const locale = toLocale((await params).lang);
  const jsonLd = breadcrumbJsonLd(locale, [
    { name: HOME_LABEL[locale], path: "/" },
    {
      name: locale === "fr" ? "Gestionnaires immobiliers" : "Property Managers",
      path: "/gestionnaires",
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
                name: "How fast can you respond to a water damage emergency?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "Our line is answered 24/7. One call gets a project manager on site same day. We respond to water damage emergencies across Laval and Montreal with extraction, drying, and reconstruction crews.",
                },
              },
              {
                "@type": "Question",
                name: "Do you provide a single point of contact for each job?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "Yes. One project manager owns the file from inspection to final invoice. You never get transferred or have to explain the same loss to a different person.",
                },
              },
              {
                "@type": "Question",
                name: "Can you work in an occupied building?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "Yes. We use containment, dust control, and schedule noisy phases to agreed hours. Tenants stay comfortable and common areas remain clear during the work.",
                },
              },
              {
                "@type": "Question",
                name: "Do you provide insurance-compliant documentation?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "Yes. Dated photos, written scope, drying log, and itemised invoicing. The adjuster gets what they need without a call to your office. The file moves on its own.",
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
                name: "Quel est votre délai d'intervention pour une urgence dégât d'eau ?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "Notre ligne est répondue 24/7. Un appel suffit pour qu'un chargé de projet se rende sur place le jour même. Nous intervenons pour les urgences dégât d'eau à Laval et Montréal : extraction, séchage et reconstruction.",
                },
              },
              {
                "@type": "Question",
                name: "Offrez-vous un interlocuteur unique pour chaque dossier ?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "Oui. Un seul chargé de projet suit le dossier de l'inspection à la facture finale. Vous n'êtes jamais transféré ni obligé d'expliquer le même sinistre à une autre personne.",
                },
              },
              {
                "@type": "Question",
                name: "Pouvez-vous travailler dans un immeuble occupé ?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "Oui. Nous utilisons du confinement, un contrôle de la poussière et planifions les phases bruyantes selon des heures convenues. Les locataires restent à l'aise et les aires communes restent libres pendant les travaux.",
                },
              },
              {
                "@type": "Question",
                name: "Fournissez-vous une documentation conforme aux assureurs ?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "Oui. Photos datées, portée écrite, journal de séchage et facturation détaillée. L'expert en sinistre obtient ce dont il a besoin sans appeler votre bureau. Le dossier avance tout seul.",
                },
              },
            ],
          }),
        }}
      />
      <GestionnairesContent />
    </>
  );
}