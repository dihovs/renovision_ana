import { SITE_PHONE, SITE_PHONE_TEL } from "@/lib/constants";

/**
 * An invoice token that resolves to nothing: mistyped, revoked, or a draft
 * that has no business being reachable. Static on purpose — this page must
 * render even when the database is the thing that's broken — and bilingual,
 * because an invalid link tells us nothing about its holder's language.
 */
export default function PublicInvoiceNotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#f6f8fb] px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-black/5 bg-white p-6 text-center shadow-sm sm:p-8">
        <h1 className="font-heading text-lg font-bold text-charcoal">
          Facture introuvable — Invoice not found
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-charcoal/65">
          Ce lien n&apos;est plus valide. Appelez-nous et nous vous enverrons une copie à jour.
        </p>
        <p className="mt-1 text-sm leading-relaxed text-charcoal/65">
          This link is no longer valid. Give us a call and we&apos;ll send you an up-to-date copy.
        </p>
        <a
          href={`tel:${SITE_PHONE_TEL}`}
          className="mt-5 inline-block rounded-full border-2 border-brand-blue px-4 py-2 text-sm font-bold text-brand-blue transition-colors hover:bg-brand-blue hover:text-white"
        >
          {SITE_PHONE}
        </a>
      </div>
    </main>
  );
}
