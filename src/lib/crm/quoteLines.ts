import type { QuoteLineKind, QuoteTier } from "./quoteTypes";

// The editable-line shape and its constructor, shared between:
//   - src/components/admin/QuoteBuilder.tsx (edits them, client component)
//   - src/app/admin/quotes/new/page.tsx (seeds a blank one, server component)
//   - src/app/admin/quotes/[id]/edit/page.tsx (maps saved lines, server component)
//
// This lives in its own plain module rather than inside QuoteBuilder.tsx for
// the same reason as src/lib/estimatorFaq.ts: a "use client" file's named
// exports get proxied for the RSC client-reference boundary in this Next.js
// fork, so a server component importing `blankLine` from QuoteBuilder got back
// a reference stub that throws "Attempted to call blankLine() from the server"
// the moment it's called. The type import was always fine — types are erased —
// which is why only the function ever broke.

export type EditableLine = {
  /** Local only — the server rewrites all lines on save. */
  key: string;
  kind: QuoteLineKind;
  name: string;
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  unitCost: string;
  taxable: boolean;
  optional: boolean;
  selected: boolean;
  laborHours: number | null;
  priceBookItemId: string | null;
  /** Good/Better/Best. Meaningless — and dropped on save — unless `optional`. */
  tier: QuoteTier | null;
};

let keyCounter = 0;
const nextKey = () => `line-${++keyCounter}`;

export function blankLine(kind: QuoteLineKind = "item"): EditableLine {
  return {
    key: nextKey(),
    kind,
    name: "",
    description: "",
    quantity: kind === "text" ? "" : "1",
    unit: "",
    unitPrice: "",
    unitCost: "",
    taxable: true,
    optional: false,
    selected: false,
    laborHours: null,
    priceBookItemId: null,
    tier: null,
  };
}
