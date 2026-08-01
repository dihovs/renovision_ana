import ContactContent from "@/components/pages/ContactContent";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Contactez-nous pour une soumission gratuite",
  description:
    "Joignez Renovision AnA pour une soumission de rénovation ou de restauration après dégât d'eau à Laval et Montréal. Réponse rapide, estimation gratuite.",
  path: "/contact",
});

export default function ContactPage() {
  return <ContactContent />;
}
