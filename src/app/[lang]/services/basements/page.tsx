import BasementsContent from "@/components/pages/BasementsContent";
import { localizedMetadata, serviceJsonLd } from "@/lib/seo";
import { toLocale } from "@/i18n/routing";

export const generateMetadata = localizedMetadata({
  path: "/services/basements",
  fr: {
    title: "Aménagement de sous-sol à Laval et Montréal",
    description:
      "Aménagement de sous-sol à Laval et Montréal : d'un espace brut à des pièces habitables et accueillantes. Demandez votre soumission gratuite dès aujourd'hui.",
  },
  en: {
    title: "Basement Transformations",
    description:
      "Full basement transformations from unfinished space to beautiful, livable rooms by Renovision AnA.",
  },
});

// Service schema tied to the single canonical business @id (same pattern as
// the service-area pages), plus a breadcrumb trail in the page's language.
const schema = {
  path: "/services/basements",
  fr: {
    name: "Aménagement de sous-sol",
    serviceType: "Aménagement de sous-sol",
    description:
      "Transformation de sous-sols bruts en pièces habitables : isolation, gypse, planchers, éclairage et finition complète.",
  },
  en: {
    name: "Basement Transformations",
    serviceType: "Basement Transformations",
    description:
      "Full basement transformations, from unfinished space to beautiful, livable rooms.",
  },
};

export default async function BasementsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const locale = toLocale((await params).lang);
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd(locale, schema)) }}
      />
      <BasementsContent />
    </>
  );
}
