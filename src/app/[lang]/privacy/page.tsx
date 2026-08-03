import PrivacyContent from "@/components/pages/PrivacyContent";
import { localizedMetadata } from "@/lib/seo";

export const generateMetadata = localizedMetadata({
  path: "/privacy",
  fr: {
    title: "Politique de confidentialité",
    description:
      "Quels renseignements personnels Renovision AnA recueille, pourquoi, avec qui ils sont partagés, combien de temps ils sont conservés et vos droits d'accès.",
  },
  en: {
    title: "Privacy Policy",
    description:
      "What personal information Renovision AnA collects, why, who it is shared with, how long it is kept, and how to access, correct or delete it.",
  },
});

export default function PrivacyPage() {
  return <PrivacyContent />;
}
