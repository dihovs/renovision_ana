"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { markOpenedAction, setNotesAction, setStatusAction } from "@/app/(internal)/admin/actions";
import { convertLeadAction } from "@/app/(internal)/admin/clients/actions";
import type { ConversionState } from "@/lib/crm/conversions";
import AdminNotice from "./AdminNotice";
import { LEAD_STATUSES, type LeadStatus, type StoredLead } from "@/lib/leadStore";
import AskClaude from "./AskClaude";
import type { ProjectBrief } from "@/lib/projectBrief";

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

// Slug → label for the contact form's qualifying answers. Unknown slugs fall
// back to the raw value rather than hiding — a value we didn't anticipate is
// still information the owner typed a form to get.
const ROLE_LABEL: Record<string, string> = {
  owner: "Property owner",
  property_manager: "Property manager",
  insurance: "Insurance adjuster/broker",
  syndicate: "Condo syndicate",
  other: "Other",
};

const HEARD_LABEL: Record<string, string> = {
  google: "Google",
  referral: "Referral from a friend",
  plumber: "Plumber",
  insurance_broker: "Insurance broker/adjuster",
  social: "Facebook/Instagram",
  neighbourhood: "Saw our work nearby",
  other: "Other",
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

export default function LeadPipeline({
  leads,
  photoUrls = {},
}: {
  leads: StoredLead[];
  /** Signed, short-lived URLs keyed by lead id. */
  photoUrls?: Record<string, string[]>;
}) {
  const [filter, setFilter] = useState<LeadStatus | "all">("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const counts = leads.reduce<Record<string, number>>((acc, lead) => {
    acc[lead.status] = (acc[lead.status] ?? 0) + 1;
    return acc;
  }, {});

  const unreadCount = leads.filter((l) => !l.opened_at).length;
  const visible = filter === "all" ? leads : leads.filter((l) => l.status === filter);

  return (
    <div>
      {/* Horizontally scrollable on a phone rather than wrapping into a block
          of chips that pushes the actual list below the fold. */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
          All {leads.length}
          {unreadCount > 0 && (
            <span className="ml-1.5 rounded-full bg-brand-green px-1.5 py-0.5 text-[10px] text-white">
              {unreadCount} new
            </span>
          )}
        </FilterChip>
        {LEAD_STATUSES.map((status) => (
          <FilterChip key={status} active={filter === status} onClick={() => setFilter(status)}>
            {STATUS_LABEL[status]} {counts[status] ?? 0}
          </FilterChip>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="mt-4">
          <AdminNotice title={filter === "all" ? "No leads yet" : `No ${STATUS_LABEL[filter].toLowerCase()} leads`}>
            {filter === "all" ? (
              "New enquiries from the website and phone will show up here automatically."
            ) : (
              <>
                Nothing in this stage right now.{" "}
                <button
                  type="button"
                  onClick={() => setFilter("all")}
                  className="cursor-pointer font-semibold text-brand-blue hover:underline"
                >
                  Show all leads
                </button>
                .
              </>
            )}
          </AdminNotice>
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {visible.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              photos={photoUrls[lead.id] ?? []}
              open={openId === lead.id}
              onToggle={() => {
                const opening = openId !== lead.id;
                setOpenId(opening ? lead.id : null);
                if (opening && !lead.opened_at) void markOpenedAction(lead.id);
              }}
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
      aria-pressed={active}
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
  photos,
  open,
  onToggle,
}: {
  lead: StoredLead;
  photos: string[];
  open: boolean;
  onToggle: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [notes, setNotes] = useState(lead.notes ?? "");
  const [savedNote, setSavedNote] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

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
            {!lead.opened_at && (
              <span
                aria-label="Unopened"
                title="Not opened yet"
                className="h-2 w-2 shrink-0 rounded-full bg-brand-green"
              />
            )}
            <span
              title={lead.name}
              className={`truncate font-heading text-base text-brand-blue ${
                lead.opened_at ? "font-semibold" : "font-extrabold"
              }`}
            >
              {lead.name}
            </span>
            {/* Truthy check on purpose: old leads and environments where the
                0016 migration hasn't run yet give null/undefined — silence. */}
            {lead.is_emergency && (
              <span className="shrink-0 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                Emergency
              </span>
            )}
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${STATUS_STYLE[lead.status]}`}
            >
              {STATUS_LABEL[lead.status]}
            </span>
          </div>
          <p title={lead.scope_summary || undefined} className="mt-1 truncate text-sm text-charcoal/70">
            {lead.scope_summary || "No scope recorded"}
          </p>
          <p className="mt-1 text-xs text-charcoal/45">
            {timeAgo(lead.created_at)}
            {lead.estimate_expected ? ` · ${lead.estimate_expected}` : ""}
            {lead.source && lead.source !== "website" ? ` · ${lead.source}` : ""}
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
              className="flex-1 rounded-full uppercase tracking-[0.08em] bg-brand-green px-4 py-2.5 text-center text-sm font-bold text-white hover:bg-brand-green-dark"
            >
              Call {lead.phone}
            </a>
            <a
              href={`mailto:${lead.email}`}
              className="flex-1 rounded-full uppercase tracking-[0.08em] border-2 border-brand-blue px-4 py-2.5 text-center text-sm font-bold text-brand-blue hover:bg-brand-blue-light"
            >
              Email
            </a>
          </div>

          {/* Lead → client → quote is the flow. The action is idempotent — a
              lead already converted just redirects to its existing client — so
              a double tap costs nothing. The lead row is kept and linked, never
              consumed: it is the customer's own words and the estimator's
              original numbers, and the tidied client record must not overwrite
              the evidence. */}
          <ConvertLead leadId={lead.id} />

          {/* The brief sits directly under the call button because that is the
              order you use it in: read the job, then phone them. */}
          {lead.project_brief && <Brief brief={lead.project_brief} />}

          {/* Rendered only while the card is open, so a list of thirty leads
              doesn't mount thirty assistant panels. */}
          <div className="mt-4">
            <AskClaude subject={{ kind: "lead", id: lead.id }} />
          </div>

          {photos.length > 0 && (
            <div className="mt-4">
              <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-charcoal/45">
                Photos from the customer
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {photos.map((url, i) => (
                  <button
                    key={url}
                    type="button"
                    onClick={() => setViewerIndex(i)}
                    aria-label={`Open customer photo ${i + 1}`}
                    className="shrink-0 cursor-zoom-in"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={`Customer photo ${i + 1}`}
                      className="h-24 w-24 rounded-lg border border-black/10 object-cover transition-opacity hover:opacity-90"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          <dl className="mt-4 space-y-1.5 text-sm">
            <Row label="Email" value={lead.email} />
            {lead.address && <Row label="Address" value={lead.address} />}
            {/* Qualifiers render only when answered — chat/phone leads, old
                leads, and a pending 0016 migration all simply show nothing. */}
            {lead.is_emergency != null && (
              <Row label="Emergency" value={lead.is_emergency ? "Yes" : "No"} />
            )}
            {lead.contact_role && (
              <Row label="Role" value={ROLE_LABEL[lead.contact_role] ?? lead.contact_role} />
            )}
            {lead.heard_about && (
              <Row label="Heard via" value={HEARD_LABEL[lead.heard_about] ?? lead.heard_about} />
            )}
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

      {viewerIndex !== null && (
        <PhotoViewer
          photos={photos}
          index={viewerIndex}
          onIndex={setViewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      )}
    </li>
  );
}

/**
 * Full-screen photo viewer.
 *
 * Thumbnails used to be links opening the signed URL in a new tab, which on a
 * phone dumps you on a bare image with no route back to the lead. This keeps
 * you in the CRM and offers every ordinary way out: the close button, Escape,
 * and tapping the backdrop.
 */
function PhotoViewer({
  photos,
  index,
  onIndex,
  onClose,
}: {
  photos: string[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && index < photos.length - 1) onIndex(index + 1);
      if (e.key === "ArrowLeft" && index > 0) onIndex(index - 1);
    };
    window.addEventListener("keydown", onKey);
    // Stop the page behind scrolling under the overlay on touch devices.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [index, photos.length, onClose, onIndex]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Customer photo"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close photo"
        className="absolute right-4 top-4 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition-colors hover:bg-white/25"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
        </svg>
      </button>

      {photos.length > 1 && (
        <p className="absolute left-1/2 top-6 -translate-x-1/2 text-sm font-semibold text-white/70">
          {index + 1} / {photos.length}
        </p>
      )}

      {index > 0 && (
        <ViewerArrow side="left" onClick={() => onIndex(index - 1)} />
      )}
      {index < photos.length - 1 && (
        <ViewerArrow side="right" onClick={() => onIndex(index + 1)} />
      )}

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photos[index]}
        alt={`Customer photo ${index + 1}`}
        // Stop a tap on the photo itself from closing the overlay.
        onClick={(e) => e.stopPropagation()}
        className="max-h-full max-w-full rounded-lg object-contain"
      />
    </div>
  );
}

function ViewerArrow({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={side === "left" ? "Previous photo" : "Next photo"}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`absolute top-1/2 flex h-11 w-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition-colors hover:bg-white/25 ${
        side === "left" ? "left-3" : "right-3"
      }`}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d={side === "left" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

/**
 * Lead → client, in one press.
 *
 * Idempotent: a lead already converted redirects to the client it became, so a
 * double tap costs nothing. When it refuses — the client record was archived —
 * it says so here rather than throwing, because a server action's thrown
 * message is replaced by a generic digest in production and this one has to
 * reach the person holding the phone.
 */
function ConvertLead({ leadId }: { leadId: string }) {
  const [state, convert, pending] = useActionState(
    async () => convertLeadAction(leadId),
    {} as ConversionState,
  );

  return (
    <form action={convert} className="mt-2">
      {state.error && (
        <p
          role="alert"
          className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700"
        >
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full cursor-pointer rounded-full border-2 border-brand-green px-4 py-2.5 text-center text-sm font-bold uppercase tracking-[0.08em] text-brand-green transition-colors hover:bg-brand-green hover:text-white disabled:cursor-default disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-brand-green"
      >
        {pending ? "Converting…" : "Convert to client"}
      </button>
    </form>
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

/**
 * What the assistant established during the chat.
 *
 * Facts and open questions are visually separated on purpose: one is what you
 * know, the other is what you still have to ask, and mixing them is how a
 * guess becomes a measurement between the chat and the site visit.
 */
function Brief({ brief }: { brief: ProjectBrief }) {
  return (
    <section className="mt-4 rounded-lg border border-black/10 bg-black/[0.015] p-3">
      <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-charcoal/45">The job</p>

      {brief.headline && (
        <p className="font-heading text-sm font-bold text-brand-blue">{brief.headline}</p>
      )}

      {brief.facts.length > 0 && (
        <dl className="mt-2 space-y-1">
          {brief.facts.map((fact) => (
            <div key={`${fact.label}-${fact.value}`} className="flex gap-2 text-sm">
              <dt className="w-28 shrink-0 text-charcoal/50">{fact.label}</dt>
              <dd className="min-w-0 flex-1 text-charcoal/85">{fact.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {brief.customerWords && (
        <blockquote className="mt-3 border-l-[3px] border-black/10 pl-2.5 text-sm italic leading-relaxed text-charcoal/65">
          {brief.customerWords}
        </blockquote>
      )}

      {brief.openQuestions && brief.openQuestions.length > 0 && (
        <div className="mt-3 rounded-md bg-amber-50 p-2.5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-amber-800/80">
            Still to confirm
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm text-amber-900/85">
            {brief.openQuestions.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
