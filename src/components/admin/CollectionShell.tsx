"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";

/**
 * The collection shell — one shape for every browsable section.
 *
 * The project page grew a different ad-hoc layout per section; the reference
 * reuses a single shell everywhere instead (spec §6.3): section title with a
 * chevron, a small sort caption, a `See all (n)` affordance, and a horizontal
 * rail of cards led by a dashed `+` tile. One shell means the operator learns
 * the shape once — and the rail keeps a section short where a long list
 * serves nobody (§6.11).
 *
 * `See all (n)` expands the section's detailed view *below* the rail rather
 * than replacing it, so nothing the rail offers — the `+` tile included —
 * ever becomes unreachable while the detail is open.
 */

export default function CollectionShell({
  title,
  count,
  caption,
  addTile,
  note,
  expanded,
  children,
}: {
  title: string;
  /** How many items the collection holds — the (n) in `See all (n)`. */
  count: number;
  /** The sort caption under the title — say something true ("Newest first"). */
  caption?: string;
  /** The leading dashed `+` tile — the section's creation path. */
  addTile?: ReactNode;
  /** Empty states, upload panels — anything that sits under the rail. */
  note?: ReactNode;
  /** The section's detailed view, revealed by `See all (n)`. */
  expanded?: ReactNode;
  /** The rail's cards. */
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const expandable = expanded != null && count > 0;

  return (
    <section className="rounded-xl border border-black/5 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-baseline justify-between gap-3">
        {expandable ? (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            className="flex cursor-pointer items-center gap-1 font-heading text-sm font-bold text-charcoal transition-colors hover:text-brand-blue"
          >
            {title}
            <Chevron open={open} />
          </button>
        ) : (
          <h2 className="flex items-center gap-1 font-heading text-sm font-bold text-charcoal">
            {title}
            <Chevron open={false} muted />
          </h2>
        )}

        {expandable && (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="shrink-0 cursor-pointer text-xs font-bold text-brand-blue hover:underline"
          >
            {open ? "See less" : `See all (${count})`}
          </button>
        )}
      </div>

      {caption && <p className="mt-0.5 text-xs text-charcoal/50">{caption}</p>}

      {(addTile != null || children != null) && (
        <div className="-mx-1 mt-3 flex items-stretch gap-3 overflow-x-auto px-1 pb-1">
          {addTile}
          {children}
        </div>
      )}

      {note}

      {open && expanded}
    </section>
  );
}

function Chevron({ open, muted = false }: { open: boolean; muted?: boolean }) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      aria-hidden
      className={`transition-transform ${open ? "rotate-90" : ""} ${muted ? "text-charcoal/30" : ""}`}
    >
      <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * The leading dashed `+` tile — the reference's empty/creation tile: 2px
 * dashed border, centred `+`, the same radius as the cards beside it. A link
 * when the creation path is a page, a button when it opens something in
 * place.
 */
export function AddTile({
  label,
  href,
  onClick,
}: {
  /** What tapping this creates — read to screen readers, shown on hover. */
  label: string;
  href?: string;
  onClick?: () => void;
}) {
  const className =
    "flex min-h-24 w-20 shrink-0 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-black/15 bg-black/[0.015] text-charcoal/35 transition-colors hover:border-brand-blue/40 hover:text-brand-blue";
  const plus = (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );

  if (href) {
    return (
      <Link href={href} aria-label={label} title={label} className={className}>
        {plus}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className={className}>
      {plus}
    </button>
  );
}
