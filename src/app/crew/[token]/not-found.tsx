import { SITE_PHONE, SITE_PHONE_TEL } from "@/lib/constants";

/**
 * A crew token that resolves to nothing: mistyped, revoked, expired, or a job
 * that finished long enough ago that the link has lapsed.
 *
 * Deliberately says which of those it is: none of them. A page that
 * distinguishes "no such link" from "expired link" tells a stranger which
 * tokens exist, and this page is reachable by anybody who can type a URL.
 *
 * Static, so it renders even when the database is the thing that is broken —
 * which is also the local-development case, where Supabase is unset and every
 * token resolves to nothing. Bilingual, because an invalid link tells us
 * nothing about who is holding it.
 */
export default function CrewJobNotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#f6f8fb] px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-black/5 bg-white p-6 text-center shadow-sm sm:p-8">
        <h1 className="font-heading text-xl font-bold text-charcoal">
          Lien expiré — Link expired
        </h1>
        <p className="mt-3 text-base leading-relaxed text-charcoal/65">
          Ce lien de chantier n&apos;est plus valide. Appelez le bureau et nous vous en enverrons un
          nouveau.
        </p>
        <p className="mt-2 text-base leading-relaxed text-charcoal/65">
          This job link is no longer valid. Call the office and we&apos;ll send you a new one.
        </p>
        <a
          href={`tel:${SITE_PHONE_TEL}`}
          className="mt-6 inline-flex min-h-[56px] items-center justify-center rounded-full border-2 border-brand-blue px-6 text-lg font-bold text-brand-blue transition-colors active:bg-brand-blue active:text-white"
        >
          {SITE_PHONE}
        </a>
      </div>
    </main>
  );
}
