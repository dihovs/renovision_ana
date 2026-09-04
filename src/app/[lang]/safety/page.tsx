import SafetyContent from "@/components/pages/SafetyContent";
import { localizedMetadata } from "@/lib/seo";

export const generateMetadata = localizedMetadata({
  path: "/safety",
  fr: {
    title: "Sécurité, assurances et garantie",
    description:
      "Renovision AnA est un entrepreneur assuré : garantie d'un an sur la main-d'œuvre, équipes formées en sécurité et expérience des réclamations d'assurance.",
  },
  en: {
    title: "Safety & Warranty",
    description:
      "Insurers and property managers need more than good work — they need proof. The credentials, coverage, and practices behind every Renovision AnA job site.",
  },
});

export default function SafetyPage() {
  const faq = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "What insurance coverage does Renovision AnA carry?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Comprehensive general liability insurance on every job, with certificates available on request for vendor onboarding. We also provide a one-year written workmanship warranty on all projects.",
        },
      },
      {
        "@type": "Question",
        name: "Do you have a written warranty?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. Every project comes with a one-year written warranty on workmanship, handed over with the final invoice. If something isn't right, we come back — no questions asked.",
        },
      },
      {
        "@type": "Question",
        name: "What safety procedures do your crews follow?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Every crew member follows written safe-work procedures for demolition, water damage, working at heights, and hazardous material awareness. We maintain daily cleanup, PPE requirements, and proper containment in occupied buildings.",
        },
      },
    ],
  };

  const frFaq = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Quelle couverture d'assurance Renovision AnA détient-elle ?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Une assurance responsabilité civile complète sur chaque chantier, avec attestations disponibles sur demande. Nous offrons également une garantie écrite d'un an sur la main-d'œuvre pour tous les projets.",
        },
      },
      {
        "@type": "Question",
        name: "Avez-vous une garantie écrite ?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Oui. Chaque projet est accompagné d'une garantie écrite d'un an sur la main-d'œuvre, remise avec la facture finale. Si quelque chose ne va pas, nous revenons — sans question, sans frais.",
        },
      },
      {
        "@type": "Question",
        name: "Quelles procédures de sécurité suivent vos équipes ?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Chaque membre d'équipe suit des procédures écrites de travail sécuritaire pour la démolition, les dégâts d'eau, le travail en hauteur et la manipulation de matières dangereuses. Nettoyage quotidien, EPI obligatoire et confinement approprié dans les immeubles occupés.",
        },
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faq) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(frFaq) }}
      />
      <SafetyContent />
    </>
  );
}