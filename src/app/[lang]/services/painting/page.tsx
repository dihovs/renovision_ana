import PaintingContent from "@/components/pages/PaintingContent";
import { localizedMetadata, serviceJsonLd } from "@/lib/seo";
import { toLocale } from "@/i18n/routing";

export const generateMetadata = localizedMetadata({
  path: "/services/painting",
  fr: {
    title: "Peinture intérieure à Laval et Montréal",
    description:
      "Peinture intérieure à Laval et Montréal : murs, plafonds, moulures, plinthes et portes en deux couches complètes. Demandez votre soumission gratuite.",
  },
  en: {
    title: "Interior Painting",
    description:
      "Interior painting in Laval and Montreal — walls, ceilings, trim, baseboards, and doors, with priming on new drywall and colour changes quoted upfront.",
  },
});

// Service schema tied to the single canonical business @id (same pattern as
// the service-area pages), plus a breadcrumb trail in the page's language.
const schema = {
  path: "/services/painting",
  fr: {
    name: "Peinture intérieure",
    serviceType: "Peinture intérieure",
    description:
      "Peinture de murs, plafonds, moulures, plinthes et portes en deux couches complètes, avec apprêt sur gypse neuf.",
  },
  en: {
    name: "Interior Painting",
    serviceType: "Interior Painting",
    description:
      "Walls, ceilings, trim, and doors in full two-coat coverage, with priming on new drywall.",
  },
};

export default async function PaintingPage({
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
      <PaintingContent />
    </>
  );
}
