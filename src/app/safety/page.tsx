import SafetyContent from "@/components/pages/SafetyContent";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Sécurité, assurances et garantie",
  description:
    "Renovision AnA est un entrepreneur assuré : garantie d'un an sur la main-d'œuvre, équipes formées en sécurité et expérience des réclamations d'assurance.",
  path: "/safety",
});

export default function SafetyPage() {
  return <SafetyContent />;
}
