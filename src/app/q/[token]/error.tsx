"use client";

/**
 * Fallback for the customer's copy of a quote.
 *
 * This is the one screen in the whole app where we can't assume English OR
 * French — the error boundary has no access to `quote.language` (the error
 * can fire before the page ever resolves it), so both languages are shown
 * together rather than guessing wrong in front of a customer.
 */
export default function PublicQuoteError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#f6f8fb] px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-black/5 bg-white p-6 text-center shadow-sm sm:p-8">
        <h1 className="font-heading text-lg font-bold text-charcoal">
          Un problème est survenu — Something went wrong
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-charcoal/65">
          Nous n&apos;avons pas pu afficher cette soumission. Veuillez réessayer, ou nous
          contacter si le problème persiste.
        </p>
        <p className="mt-1 text-sm leading-relaxed text-charcoal/65">
          We couldn&apos;t display this quote. Please try again, or contact us if the problem
          continues.
        </p>
        <button
          type="button"
          onClick={unstable_retry}
          className="mt-5 cursor-pointer rounded-lg bg-brand-blue px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-brand-blue/90"
        >
          Réessayer · Try again
        </button>
        {error.digest && (
          <p className="mt-4 font-mono text-[10px] text-charcoal/30">Ref: {error.digest}</p>
        )}
      </div>
    </main>
  );
}
