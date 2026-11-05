import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Building blocks for the hub-style admin pages (the client hub, Estimates).
 *
 * The CRM grew card by card, each page repeating the same class strings with
 * small drifts. These pin them down once: a card, a section header with its
 * one create action, a status pill whose colour means the same thing on every
 * screen, an empty state that says what to do next, and the list row every
 * section uses. Server components — no client JS.
 *
 * Colour vocabulary, matching ProjectStatusPill and the jobs screen:
 * blue = underway, amber = waiting on someone, green = done / paid,
 * red = needs attention, grey = out of the way.
 */

export type Tone = "blue" | "amber" | "green" | "red" | "grey";

const TONE: Record<Tone, string> = {
  blue: "bg-brand-blue/[0.08] text-brand-blue",
  amber: "bg-amber-100 text-amber-800",
  green: "bg-green-100 text-green-800",
  red: "bg-red-100 text-red-700",
  grey: "bg-black/[0.05] text-charcoal/55",
};

export function Card({
  children,
  className = "",
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={`scroll-mt-20 rounded-2xl border border-black/[0.06] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] ${className}`}
    >
      {children}
    </section>
  );
}

/** A section's title row: icon, title, count, and at most one action. */
export function SectionHeader({
  icon,
  title,
  count,
  action,
}: {
  icon?: ReactNode;
  title: string;
  count?: number;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-2 sm:px-5">
      <div className="flex min-w-0 items-center gap-2">
        {icon && <span className="text-brand-blue">{icon}</span>}
        <h2 className="truncate font-heading text-[15px] font-bold text-charcoal">{title}</h2>
        {count !== undefined && count > 0 && (
          <span className="rounded-full bg-black/[0.05] px-1.5 py-px text-[11px] font-bold text-charcoal/55">
            {count}
          </span>
        )}
      </div>
      {action}
    </div>
  );
}

export function StatusPill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${TONE[tone]}`}
    >
      {children}
    </span>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="px-4 pb-4 text-sm text-charcoal/45 sm:px-5">{children}</p>;
}

/** The small "+ New …" link in a section header. */
export function AddLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[13px] font-bold text-brand-blue transition-colors hover:bg-brand-blue/[0.06]"
    >
      <PlusIcon />
      {children}
    </Link>
  );
}

/** One row in a section list: what it is, its state, its amount, its date. */
export function HubRow({
  href,
  title,
  subtitle,
  status,
  amount,
  meta,
}: {
  href: string;
  title: string;
  subtitle?: string | null;
  status?: { tone: Tone; label: string };
  amount?: string | null;
  meta?: string | null;
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-black/[0.02] sm:px-5"
      >
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-semibold text-charcoal">{title}</span>
            {status && <StatusPill tone={status.tone}>{status.label}</StatusPill>}
          </div>
          {subtitle && <p className="mt-0.5 truncate text-xs text-charcoal/50">{subtitle}</p>}
        </div>
        <div className="shrink-0 text-right">
          {amount && <div className="text-sm font-bold tabular-nums text-charcoal">{amount}</div>}
          {meta && <div className="text-[11px] text-charcoal/40">{meta}</div>}
        </div>
        <ChevronIcon />
      </Link>
    </li>
  );
}

export function HubList({ children }: { children: ReactNode }) {
  return <ul className="divide-y divide-black/[0.05] border-t border-black/[0.05]">{children}</ul>;
}

/** A figure in the summary strip under a hub's header. */
export function StatTile({ label, value, tone }: { label: string; value: string; tone?: Tone }) {
  const colour =
    tone === "red" ? "text-red-700" : tone === "green" ? "text-green-700" : "text-charcoal";
  return (
    <div className="rounded-xl bg-[#f6f8fb] px-3 py-2.5">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-charcoal/45">{label}</div>
      <div className={`mt-0.5 font-heading text-lg font-bold tabular-nums ${colour}`}>{value}</div>
    </div>
  );
}

/**
 * A round quick-action button with its label underneath (Call, Text, Email,
 * Directions). Rendered as a plain link so tel:, sms:, mailto: and map URLs
 * open the phone's own apps; with no href it shows disabled rather than
 * vanishing, so the row keeps its shape and the missing detail is visible.
 */
export function QuickAction({
  href,
  label,
  icon,
  external,
}: {
  href: string | null;
  label: string;
  icon: ReactNode;
  external?: boolean;
}) {
  const inner = (
    <>
      <span
        className={`flex h-11 w-11 items-center justify-center rounded-full ${
          href ? "bg-brand-blue/[0.08] text-brand-blue" : "bg-black/[0.04] text-charcoal/25"
        }`}
      >
        {icon}
      </span>
      <span className={`text-xs font-semibold ${href ? "text-charcoal/75" : "text-charcoal/30"}`}>
        {label}
      </span>
    </>
  );
  if (!href) {
    return (
      <span aria-disabled className="flex flex-col items-center gap-1.5">
        {inner}
      </span>
    );
  }
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
      className="flex flex-col items-center gap-1.5 rounded-xl py-1 transition-opacity hover:opacity-80"
    >
      {inner}
    </a>
  );
}

// ---------------------------------------------------------------------------
// Icons — our own line set, 20px, stroke = currentColor.
// ---------------------------------------------------------------------------

function Svg({ children, size = 20 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

export const PlusIcon = () => (
  <Svg size={15}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);
export const ChevronIcon = () => (
  <span className="text-charcoal/25">
    <Svg size={16}>
      <path d="M9 6l6 6-6 6" />
    </Svg>
  </span>
);
export const PhoneIcon = () => (
  <Svg>
    <path d="M5 4h3.5l1.5 4-2 1.5a11 11 0 0 0 6.5 6.5l1.5-2 4 1.5V19a1.5 1.5 0 0 1-1.5 1.5A16.5 16.5 0 0 1 3.5 5.5 1.5 1.5 0 0 1 5 4z" />
  </Svg>
);
export const ChatIcon = () => (
  <Svg>
    <path d="M4 5.5h16v10H9l-4 3.5v-3.5H4z" />
  </Svg>
);
export const MailIcon = () => (
  <Svg>
    <rect x="3.5" y="5.5" width="17" height="13" rx="1.5" />
    <path d="M4 7l8 6 8-6" />
  </Svg>
);
export const PinIcon = () => (
  <Svg>
    <path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z" />
    <circle cx="12" cy="10" r="2.3" />
  </Svg>
);
export const HouseIcon = () => (
  <Svg size={18}>
    <path d="M4 11l8-6.5 8 6.5M6 9.5V19h12V9.5" />
  </Svg>
);
export const InboxIcon = () => (
  <Svg size={18}>
    <path d="M4 13l2.5-7h11L20 13v5.5H4zM4 13h4.5l1 2h5l1-2H20" />
  </Svg>
);
export const RulerIcon = () => (
  <Svg size={18}>
    <path d="M4 16.5L16.5 4 20 7.5 7.5 20zM8 12.5l1.5 1.5M10.5 10l1.5 1.5M13 7.5l1.5 1.5" />
  </Svg>
);
export const DocIcon = () => (
  <Svg size={18}>
    <path d="M7 3.5h7l4 4V20.5H7zM14 3.5V8h4M9.5 12.5h6M9.5 16h6" />
  </Svg>
);
export const FolderIcon = () => (
  <Svg size={18}>
    <path d="M3.5 7V18.5h17V8.5H12L10 6H3.5z" />
  </Svg>
);
export const WrenchIcon = () => (
  <Svg size={18}>
    <path d="M14.5 4a4.5 4.5 0 0 0-4.2 6.1L4 16.4 7.6 20l6.3-6.3A4.5 4.5 0 0 0 20 9.5l-2.7 2.7-2.6-.6-.6-2.6L16.8 6.3A4.5 4.5 0 0 0 14.5 4z" />
  </Svg>
);
export const ReceiptIcon = () => (
  <Svg size={18}>
    <path d="M6 3.5h12v17l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4-2 1.4zM9 8h6M9 11.5h6M9 15h4" />
  </Svg>
);
