import SewerBackupContent from "@/components/pages/SewerBackupContent";
import { localizedMetadata, serviceJsonLd } from "@/lib/seo";
import { toLocale } from "@/i18n/routing";

/**
 * The slug is English (`sewer-backup`) to match the other eight service pages,
 * even though the French phrase is the one this page is really competing for.
 * Consistency won over an exact-match slug: the routing serves both languages
 * from the same path, so a French slug would put `/en/services/refoulement
 * -egout` in front of English readers. « Refoulement d'égout » carries the
 * page instead — it is the title, the H1 and the schema serviceType in French.
 */
export const generateMetadata = localizedMetadata({
  path: "/services/sewer-backup",
  fr: {
    title: "Refoulement d'égout à Laval et Montréal",
    description:
      "Nettoyage après refoulement d'égout à Laval et Montréal : extraction, désinfection, retrait des matériaux contaminés et remise en état. Urgence répondue 24/7.",
  },
  en: {
    title: "Sewer Backup Cleanup & Restoration",
    description:
      "Sewer backup cleanup in Laval and Montreal — extraction, disinfection, removal of contaminated material, and full rebuild. Emergency line answered 24/7.",
  },
});

const schema = {
  path: "/services/sewer-backup",
  fr: {
    name: "Nettoyage après refoulement d'égout",
    serviceType: "Refoulement d'égout",
    description:
      "Extraction de l'eau contaminée, désinfection, retrait des matériaux poreux imbibés, séchage documenté et remise en état complète après un refoulement d'égout.",
  },
  en: {
    name: "Sewer Backup Cleanup",
    serviceType: "Sewer Backup Cleanup",
    description:
      "Contaminated water extraction, disinfection, removal of soaked porous material, documented drying, and full rebuild after a sewer backup.",
  },
};

export default async function SewerBackupPage({
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
      <SewerBackupContent />
    </>
  );
}
