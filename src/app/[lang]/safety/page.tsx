import SafetyContent from "@/components/pages/SafetyContent";
import { localizedMetadata } from "@/lib/seo";

// The English description is taken verbatim from this page's own English body
// copy rather than restored from history: the old English meta said "licensed
// and insured", and there is no RBQ licence. Insured with a one-year
// workmanship warranty is the true claim, and it is what the page says.
export const generateMetadata = localizedMetadata({
  path: "/safety",
  fr: {
    title: "Sécurité, assurances et garantie",
    description:
      "Renovision AnA est un entrepreneur assuré : garantie d'un an sur la main-d'œuvre, équipes formées en sécurité et expérience des réclamations d'assurance.",
  },
  en: {
    title: "Safety & Certifications",
    description:
      "Insurance companies and property managers need more than good work — they need proof. Here are the credentials, coverage, and practices behind every Renovision AnA job site.",
  },
});

export default function SafetyPage() {
  return <SafetyContent />;
}
