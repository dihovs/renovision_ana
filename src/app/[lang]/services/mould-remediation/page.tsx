import MouldRemediationContent from "@/components/pages/MouldRemediationContent";
import { localizedMetadata, serviceJsonLd } from "@/lib/seo";
import { toLocale } from "@/i18n/routing";
import { MOULD_FAQ } from "@/lib/serviceFaq";

/**
 * The content backlog specified `/services/moisissure`. The slug is English
 * here for the same reason `sewer-backup` is: routing serves both languages
 * from one path, so a French slug puts `/en/services/moisissure` in front of
 * English readers. « Moisissure » carries the page instead — it is the title,
 * the H1, the eyebrow and the French schema serviceType.
 */
export const generateMetadata = localizedMetadata({
  path: "/services/mould-remediation",
  fr: {
    title: "Décontamination de moisissure à Laval et Montréal",
    description:
      "Moisissure au sous-sol ou après un dégât d'eau à Laval et Montréal : on trouve la source, on retire ce qui est contaminé, on refait la pièce.",
  },
  en: {
    title: "Mould Removal and Remediation in Laval",
    description:
      "Mould in a basement or after water damage in Laval and Montreal: we find the source, remove what's contaminated, and rebuild the room. Answered 24/7.",
  },
});

const schema = {
  path: "/services/mould-remediation",
  fr: {
    name: "Décontamination de moisissure",
    serviceType: "Moisissure",
    description:
      "Diagnostic de la source, confinement, retrait des matériaux poreux contaminés, séchage documenté et remise en état complète après une contamination par la moisissure.",
  },
  en: {
    name: "Mould Remediation",
    serviceType: "Mould Remediation",
    description:
      "Source diagnosis, containment, removal of contaminated porous material, documented drying, and full rebuild after mould contamination.",
  },
};

export default async function MouldRemediationPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const locale = toLocale((await params).lang);
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          // Same array the page renders — see serviceFaq.ts.
          __html: JSON.stringify(serviceJsonLd(locale, { ...schema, faq: MOULD_FAQ[locale] })),
        }}
      />
      <MouldRemediationContent />
    </>
  );
}
