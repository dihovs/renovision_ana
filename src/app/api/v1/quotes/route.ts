import { guarded } from "../guard";
import { listQuotes } from "@/lib/crm/quotes";
import { QUOTE_STATUSES, type QuoteStatus } from "@/lib/crm/quoteTypes";

/** The quote list, wrapping the same `listQuotes` the web admin page calls. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const status = params.get("status");
  const limit = Number(params.get("limit"));

  return guarded(async () => ({
    quotes: await listQuotes({
      status: QUOTE_STATUSES.includes(status as QuoteStatus) ? (status as QuoteStatus) : undefined,
      clientId: params.get("clientId") || undefined,
      search: params.get("q") || undefined,
      limit: Number.isFinite(limit) && limit > 0 ? Math.min(limit, 200) : undefined,
    }),
  }));
}
