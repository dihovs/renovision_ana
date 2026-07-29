"use client";

import { useState, useTransition } from "react";
import { setNotesAction, setStatusAction } from "@/app/admin/actions";
import { LEAD_STATUSES, type LeadStatus, type StoredLead } from "@/lib/leadStore";

const STATUS_LABEL: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Called",
  quoted: "Quoted",
  won: "Won",
  lost: "Lost",
};

// Won and lost are the only two that end the conversation, so they're the only
// two that get colour weight — everything else is a step, not an outcome.
const STATUS_STYLE: Record<LeadStatus, string> = {
  new: "bg-brand-green text-white",
  contacted: "bg-brand-blue text-white",
  quoted: "bg-amber-500 text-white",
  won: "bg-emerald-700 text-white",
  lost: "bg-charcoal/40 text-white",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 60) return `${Math.max(1, mins)} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 31) return `${days} d ago`;
  return new Date(iso).toLocaleDateString("en-CA");
}

export default function LeadPipeline({ leads }: { leads: StoredLead[] }) {
  const [filter, setFilter] = useState<LeadStatus | "all">("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const counts = leads.reduce<Record<string, number>>((acc, lead) => {
    acc[lead.status] = (acc[lead.status] ?? 0) + 1;
    return acc;
  }, {});

  const visible = filter === "all" ? leads : leads.filter((l) => l.status === filter);

  return (
    <div>
      {/* Horizontally scrollable on a phone rather than wrapping into a block
          of chips that pushes the actual list below the fold. */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
          All {leads.length}
        </FilterChip>
        {LEAD_STATUSES.map((status) => (
          <FilterChip key={status} active={filter === status} onClick={() => setFilter(status)}>
            {STATUS_LABEL[status]} {counts[status] ?? 0}
          </FilterChip>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="mt-8 text-sm text-charcoal/60">Nothing here yet.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {visible.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              open={openId === lead.id}
              onToggle={() => setOpenId(openId === lead.id ? null : lead.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${
        active ? "bg-brand-blue text-white" : "bg-black/5 text-charcoal/70 hover:bg-black/10"
      }`}
    >
      {children}
    </button>
  );
}

function LeadCard({
  lead,
  open,
  onToggle,
}: {
  lead: StoredLead;
  open: boolean;
  onToggle: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [notes, setNotes] = useState(lead.notes ?? "");
  const [savedNote, setSavedNote] = useState(false);

  return (
    <li className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-start justify-between gap-3 p-4 text-left"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate font-heading text-base font-bold text-brand-blue">
              {lead.name}
            </span>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${STATUS_STYLE[lead.status]}`}
            >
              {STATUS_LABEL[lead.status]}
            </span>
          </div>
          <p className="mt-1 truncate text-sm text-charcoal/70">
            {lead.scope_summary || "No scope recorded"}
          </p>
          <p className="mt-1 text-xs text-charcoal/45">
            {timeAgo(lead.created_at)}
            {lead.estimate_expected ? ` · ${lead.estimate_expected}` : ""}
          </p>
        </div>
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
          className={`mt-1 shrink-0 text-charcoal/40 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-black/5 px-4 pb-4 pt-3">
          {/* Call and email first: on a job site this is the whole point of
              opening the card, so it comes before any of the detail. */}
          <div className="flex flex-wrap gap-2">
            <a
              href={`tel:${lead.phone}`}
              className="flex-1 rounded-full bg-brand-green px-4 py-2.5 text-center text-sm font-bold text-white hover:bg-brand-green-dark"
            >
              Call {lead.phone}
            </a>
            <a
              href={`mailto:${lead.email}`}
              className="flex-1 rounded-full border-2 border-brand-blue px-4 py-2.5 text-center text-sm font-bold text-brand-blue hover:bg-brand-blue-light"
            >
              Email
            </a>
          </div>

          <dl className="mt-4 space-y-1.5 text-sm">
            <Row label="Email" value={lead.email} />
            {lead.address && <Row label="Address" value={lead.address} />}
            <Row label="Language" value={lead.locale.toUpperCase()} />
            {lead.estimate_low && (
              <Row label="Range" value={`${lead.estimate_low} – ${lead.estimate_high}`} />
            )}
            {lead.total && <Row label="Total w/ tax" value={lead.total} />}
            {lead.estimated_work_days != null && (
              <Row label="Est. days" value={String(lead.estimated_work_days)} />
            )}
            <Row label="Marketing" value={lead.marketing_consent ? "Opted in" : "No"} />
          </dl>

          <div className="mt-4">
            <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-charcoal/45">
              Status
            </p>
            <div className="flex flex-wrap gap-1.5">
              {LEAD_STATUSES.map((status) => (
                <button
                  key={status}
                  type="button"
                  disabled={pending || status === lead.status}
                  onClick={() => startTransition(() => void setStatusAction(lead.id, status))}
                  className={`cursor-pointer rounded-full px-3 py-1.5 text-xs font-bold transition-colors disabled:cursor-default ${
                    status === lead.status
                      ? STATUS_STYLE[status]
                      : "bg-black/5 text-charcoal/70 hover:bg-black/10"
                  }`}
                >
                  {STATUS_LABEL[status]}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-charcoal/45">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                setSavedNote(false);
              }}
              rows={3}
              placeholder="What was discussed, what to follow up on…"
              className="w-full rounded-xl border border-black/10 bg-black/[0.02] px-3 py-2 text-sm outline-none focus:border-brand-blue"
            />
            <div className="mt-2 flex items-center gap-3">
              <button
                type="button"
                disabled={pending || notes === (lead.notes ?? "")}
                onClick={() =>
                  startTransition(async () => {
                    await setNotesAction(lead.id, notes);
                    setSavedNote(true);
                  })
                }
                className="cursor-pointer rounded-full bg-brand-blue px-4 py-2 text-xs font-bold text-white hover:bg-brand-blue-dark disabled:opacity-40"
              >
                Save note
              </button>
              {savedNote && <span className="text-xs text-brand-green">Saved</span>}
            </div>
          </div>
        </div>
      )}
    </li>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <dt className="w-28 shrink-0 text-charcoal/50">{label}</dt>
      <dd className="min-w-0 break-words text-charcoal/85">{value}</dd>
    </div>
  );
}
