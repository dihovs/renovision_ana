import ContactContent from "@/components/pages/ContactContent";
import { localizedMetadata } from "@/lib/seo";

export const generateMetadata = localizedMetadata({
  path: "/contact",
  fr: {
    title: "Contactez-nous pour une soumission gratuite",
    description:
      "Joignez Renovision AnA pour une soumission de rénovation ou de restauration après dégât d'eau à Laval et Montréal. Réponse rapide, estimation gratuite.",
  },
  en: {
    title: "Contact",
    description:
      "Get in touch with Renovision AnA for a renovation, water damage restoration, or remodeling estimate in Laval and greater Montreal.",
  },
});

export default function ContactPage() {
  return <ContactContent />;
}
