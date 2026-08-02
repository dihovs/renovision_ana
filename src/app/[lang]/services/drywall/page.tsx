import DrywallContent from "@/components/pages/DrywallContent";
import { localizedMetadata, serviceJsonLd } from "@/lib/seo";
import { toLocale } from "@/i18n/routing";

export const generateMetadata = localizedMetadata({
  path: "/services/drywall",
  fr: {
    title: "Pose et finition de gypse à Laval et Montréal",
    description:
      "Installation, tirage de joints et réparation de gypse à Laval et Montréal — panneaux standards, hydrofuges et coupe-feu, prêts à peindre. Soumission gratuite.",
  },
  en: {
    title: "Drywall Installation & Finishing",
    description:
      "Drywall installation, taping, plastering, and repairs in Laval and Montreal — standard, fire-rated Type X, and moisture-resistant board finished ready to paint.",
  },
});

// Service schema tied to the single canonical business @id (same pattern as
// the service-area pages), plus a breadcrumb trail in the page's language.
const schema = {
  path: "/services/drywall",
  fr: {
    name: "Installation et finition de gypse",
    serviceType: "Pose et finition de gypse",
    description:
      "Pose, tirage de joints et finition de gypse — panneaux standards, hydrofuges et coupe-feu — ainsi que réparations de toutes tailles.",
  },
  en: {
    name: "Drywall Installation & Finishing",
    serviceType: "Drywall Installation & Finishing",
    description:
      "Board hung, taped, and finished flat — from a single patch to a full room, ready for primer.",
  },
};

export default async function DrywallPage({
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
      <DrywallContent />
    </>
  );
}
