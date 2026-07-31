import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { approveAction, requestChangesAction } from "./actions";
import PublicQuote from "@/components/quote/PublicQuote";
import { getQuoteByToken, recordQuoteView, resolveQuoteTaxRateForQuote } from "@/lib/crm/quotes";
import { getCompany } from "@/lib/crm/settings";

/**
 * The customer's copy of a quote.
 *
 * No session — the token IS the credential, which is why it is 32 random bytes
 * rather than the row id. Never indexed: this is one customer's pricing, and a
 * quote turning up in a search result would be a disclosure, not a feature.
 */
export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function PublicQuotePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const quote = await getQuoteByToken(token);
  // A draft has no business being reachable even if a token somehow exists —
  // it is a working document, not an offer.
  if (!quote || quote.status === "draft") notFound();

  // Fire-and-forget: the customer must never wait on our analytics, and a
  // failure here must never cost them the page.
  void recordQuoteView(token).catch(() => {});

  const [company, taxRate] = await Promise.all([
    getCompany(),
    resolveQuoteTaxRateForQuote(quote),
  ]);

  return (
    <main className="min-h-dvh bg-[#f6f8fb]">
      <PublicQuote
        quote={quote}
        company={company}
        taxRate={taxRate}
        approveAction={approveAction.bind(null, token)}
        requestChangesAction={requestChangesAction.bind(null, token)}
      />
    </main>
  );
}
