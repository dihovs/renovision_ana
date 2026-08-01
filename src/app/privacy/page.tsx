import PrivacyContent from "@/components/pages/PrivacyContent";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Politique de confidentialité",
  description:
    "Quels renseignements personnels Renovision AnA recueille, pourquoi, avec qui ils sont partagés, combien de temps ils sont conservés et vos droits d'accès.",
  path: "/privacy",
});

export default function PrivacyPage() {
  return <PrivacyContent />;
}
