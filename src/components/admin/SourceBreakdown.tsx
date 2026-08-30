"use client";

import { leadBreakdown, type BreakdownRow } from "@/lib/leads/breakdown";
import type { StoredLead } from "@/lib/leadStore";

/**
 * Where the leads came from, above the list.
 *
 * CLOSED BY DEFAULT, and the summary line carries the answer anyway. The filter
 * chips below already fight for the top of this screen — the file that renders
 * them says outright that a block of chips pushing the list below the fold is
 * the thing to avoid, and a permanently expanded chart would do exactly that
 * for a number nobody needs on every visit. Open it when the question is "where
 * is the work coming from", not when the question is "who do I call next".
 *
 * TWO LISTS, NEVER ONE RANKING. The online counts are a record of what the
 * browser saw; the "told us" counts are what customers said about themselves.
 * Merging them would read as one fact and be two — see breakdown.ts.
 */
export default function SourceBreakdown({ leads }: { leads: StoredLead[] }) {
  const { online, offline, unattributed, total } = leadBreakdown(leads);

  // Nothing to summarise. One lead is a list, not a breakdown.
  if (total < 2) return null;

  const top = online[0];
  const summary = top
    ? `${top.label} leads, ${top.count} of ${total}`
    : `${total} leads, none attributed yet`;

  return (
    <details className="mb-3 rounded-2xl border border-black/5 bg-white shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 text-left">
        <span className="min-w-0">
          <span className="font-heading text-sm font-semibold text-brand-blue">
            Where they come from
          </span>
          <span className="ml-2 truncate text-sm text-charcoal/60">{summary}</span>
        </span>
        <span aria-hidden className="shrink-0 text-charcoal/40 transition-transform">
          ▾
        </span>
      </summary>

      <div className="grid gap-6 border-t border-black/5 p-4 sm:grid-cols-2">
        <Column
          title="How they arrived"
          note="Recorded from the referrer — no cookies, no tracking."
          rows={online}
          total={total}
          empty="Nothing recorded yet."
          footer={
            unattributed > 0
              ? `${unattributed} of ${total} arrived without a referrer — typed the address, or came from a link that carried nothing. These are the ones asked "how did you hear about us".`
              : null
          }
        />
        <Column
          title="What they told us"
          note="Self-reported, and the only way to see a plumber or a broker sending work."
          rows={offline}
          total={total}
          empty="Nobody has answered yet. New leads are asked only when the referrer came back empty."
          footer={null}
        />
      </div>
    </details>
  );
}

function Column({
  title,
  note,
  rows,
  total,
  empty,
  footer,
}: {
  title: string;
  note: string;
  rows: BreakdownRow[];
  total: number;
  empty: string;
  footer: string | null;
}) {
  return (
    <div>
      <h3 className="font-heading text-sm font-semibold text-charcoal">{title}</h3>
      <p className="mt-0.5 text-xs leading-snug text-charcoal/50">{note}</p>

      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-charcoal/50">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {rows.map((row) => (
            <li key={row.label} className="flex items-center gap-3">
              <span className="w-32 shrink-0 truncate text-sm text-charcoal/80" title={row.label}>
                {row.label}
              </span>
              {/* The bar is scaled against the biggest row, not the total: with
                  six leads every share-of-total bar is a sliver and the chart
                  says nothing. Relative length is the readable comparison. */}
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-black/5">
                <span
                  className="block h-full rounded-full bg-brand-blue"
                  style={{ width: `${Math.round((row.count / rows[0].count) * 100)}%` }}
                />
              </span>
              <span className="w-6 shrink-0 text-right font-mono text-sm tabular-nums text-charcoal">
                {row.count}
              </span>
            </li>
          ))}
        </ul>
      )}

      {footer && <p className="mt-3 text-xs leading-snug text-charcoal/50">{footer}</p>}
      <p className="sr-only">{`${rows.length} of ${total} leads shown in this column.`}</p>
    </div>
  );
}
