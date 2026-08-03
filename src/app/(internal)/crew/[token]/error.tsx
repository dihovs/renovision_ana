"use client";

import { useEffect } from "react";
import { SITE_PHONE, SITE_PHONE_TEL } from "@/lib/constants";

/**
 * Fallback for the crew sheet.
 *
 * Bilingual side by side rather than picking one: the boundary can fire before
 * the page has resolved anything, including which language to render in.
 *
 * The retry button is `unstable_retry` in this fork of Next, not `reset`.
 */
export default function CrewJobError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#f6f8fb] px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-black/5 bg-white p-6 text-center shadow-sm sm:p-8">
        <h1 className="font-heading text-xl font-bold text-charcoal">
          Un problème est survenu — Something went wrong
        </h1>
        <p className="mt-3 text-base leading-relaxed text-charcoal/65">
          Impossible d&apos;afficher la feuille de chantier. Réessayez, ou appelez le bureau.
        </p>
        <p className="mt-2 text-base leading-relaxed text-charcoal/65">
          We couldn&apos;t load the job sheet. Try again, or call the office.
        </p>
        <button
          type="button"
          onClick={() => unstable_retry()}
          className="mt-6 min-h-[56px] w-full cursor-pointer rounded-xl bg-brand-blue px-4 text-lg font-bold text-white transition-colors active:bg-brand-blue-dark"
        >
          Réessayer · Try again
        </button>
        <a
          href={`tel:${SITE_PHONE_TEL}`}
          className="mt-3 inline-flex min-h-[56px] w-full items-center justify-center rounded-xl border-2 border-brand-blue px-4 text-lg font-bold text-brand-blue"
        >
          {SITE_PHONE}
        </a>
        {error.digest && (
          <p className="mt-4 font-mono text-[10px] text-charcoal/30">Ref: {error.digest}</p>
        )}
      </div>
    </main>
  );
}
