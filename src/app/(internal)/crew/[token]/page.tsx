import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CrewChecklist, VisitDoneButton } from "./CrewActions";
import { toggleChecklistItemAction, toggleVisitDoneAction } from "./actions";
import { getCrewJob, type CrewJobPayload, type CrewVisit } from "@/lib/crm/crewView";
import { formatQuantity } from "@/lib/crm/money";

/**
 * The crew view of a job.
 *
 * One link, one job, no session, no money. Whoever is doing the work opens
 * this on a phone in a driveway and needs four things inside three seconds:
 * where, when, who to ring, and what to do. That is the order of the page.
 *
 * What is NOT here is the point of the feature. There is no total, no line
 * price, no cost, no margin and no invoice, because the link gets forwarded —
 * to a subcontractor, to their brother-in-law with the van, into a group chat
 * — and every one of those readers is a person we have not decided to show our
 * pricing to. The boundary is enforced in `crewJobPayload`, not here: this file
 * cannot render a number it was never handed.
 *
 * Never indexed. Bilingual, French first, same convention as the client hub.
 */
export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const TZ = "America/Toronto";

type CrewLocale = "fr" | "en";

const COPY = {
  fr: {
    crewSheet: "Feuille de chantier",
    job: "Mandat",
    language: "Langue",
    cancelled: "MANDAT ANNULÉ — ne pas se présenter",
    completed: "Travaux terminés",
    where: "Adresse",
    openMaps: "Ouvrir dans Maps",
    access: "Accès sur place",
    when: "Quand",
    noVisit: "Aucune visite planifiée. Confirmez avec le bureau.",
    allDay: "Toute la journée",
    contact: "Client sur place",
    call: "Appeler",
    noPhone: "Aucun numéro au dossier — passez par le bureau.",
    instructions: "Consignes",
    work: "Travaux à faire",
    noWork: "Aucun détail des travaux. Suivez les consignes ci-dessus.",
    checklist: "Liste de vérification",
    noChecklist: "Rien sur la liste.",
    checklistUnavailable: "Liste indisponible pour le moment.",
    photos: "Photos",
    noPhotos: "Aucune photo.",
    photosUnavailable: "Photos indisponibles pour le moment.",
    openPhoto: "Voir en grand",
    markDone: "marquer comme fait",
    markNotDone: "marquer comme non fait",
    doneTemplate: "{done} sur {total} faits",
    failed: "Non enregistré. Vérifiez votre réseau et réessayez.",
    visitDone: "Marquer la visite terminée",
    visitDoneUndo: "Visite terminée",
    noPrices: "Cette feuille ne contient aucun prix. Pour toute question de facturation, appelez le bureau.",
  },
  en: {
    crewSheet: "Job sheet",
    job: "Job",
    language: "Language",
    cancelled: "JOB CANCELLED — do not attend",
    completed: "Work complete",
    where: "Address",
    openMaps: "Open in Maps",
    access: "Site access",
    when: "When",
    noVisit: "No visit scheduled. Check with the office.",
    allDay: "All day",
    contact: "Customer on site",
    call: "Call",
    noPhone: "No number on file — go through the office.",
    instructions: "Instructions",
    work: "Work to do",
    noWork: "No work detail. Follow the instructions above.",
    checklist: "Checklist",
    noChecklist: "Nothing on the list.",
    checklistUnavailable: "Checklist unavailable right now.",
    photos: "Photos",
    noPhotos: "No photos.",
    photosUnavailable: "Photos unavailable right now.",
    openPhoto: "View full size",
    markDone: "mark done",
    markNotDone: "mark not done",
    doneTemplate: "{done} of {total} done",
    failed: "Not saved. Check your signal and try again.",
    visitDone: "Mark visit complete",
    visitDoneUndo: "Visit complete",
    noPrices: "This sheet carries no prices. For anything about billing, call the office.",
  },
};

/** Both locales are structurally identical; `as const` is left off so they are
 *  the same type rather than two unrelated bags of string literals. */
type CrewCopy = (typeof COPY)["fr"];

function formatDay(iso: string, locale: CrewLocale): string {
  return new Date(iso).toLocaleDateString(locale === "fr" ? "fr-CA" : "en-CA", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: TZ,
  });
}

function formatTime(iso: string, locale: CrewLocale): string {
  return new Date(iso).toLocaleTimeString(locale === "fr" ? "fr-CA" : "en-CA", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  });
}

/** Date-only column ("2026-08-10"), rendered as a date and not an instant. */
function formatDate(iso: string, locale: CrewLocale): string {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString(
    locale === "fr" ? "fr-CA" : "en-CA",
    { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" },
  );
}

/**
 * The visit to lead with: the next one that hasn't happened, or failing that
 * the last one. A crew opening this at 07:40 wants today's window at the top,
 * not the first day of a three-week job.
 */
function leadVisit(visits: CrewVisit[], now: Date): CrewVisit | null {
  const upcoming = visits.find(
    (visit) => !visit.completedAt && Date.parse(visit.endsAt ?? visit.startsAt) >= now.getTime(),
  );
  return upcoming ?? visits.at(-1) ?? null;
}

export default async function CrewJobPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const [{ token }, { lang }] = await Promise.all([params, searchParams]);

  const job = await getCrewJob(token);
  if (!job) notFound();

  const locale: CrewLocale = lang === "en" ? "en" : "fr";
  const t = COPY[locale];
  const now = new Date();
  const next = leadVisit(job.visits, now);

  return (
    <main
      lang={locale === "fr" ? "fr-CA" : "en-CA"}
      className="min-h-dvh bg-[#f6f8fb] pb-16 text-charcoal"
    >
      <div className="mx-auto max-w-2xl px-4 py-5">
        <header className="mb-5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-charcoal/45">
              {t.crewSheet} · {t.job} #{job.jobNumber}
            </p>
            <h1 className="mt-1 font-heading text-2xl font-bold leading-tight text-charcoal">
              {job.title || `${t.job} #${job.jobNumber}`}
            </h1>
          </div>
          <nav
            aria-label={t.language}
            className="flex shrink-0 rounded-full border border-black/10 bg-white p-0.5"
          >
            <LangLink token={token} locale="fr" current={locale} />
            <LangLink token={token} locale="en" current={locale} />
          </nav>
        </header>

        {/* The one status that changes what somebody does next. Loud, and
            above everything else on the page. */}
        {job.status === "cancelled" && (
          <p
            role="alert"
            className="mb-5 rounded-2xl border-2 border-red-400 bg-red-50 px-4 py-4 text-center font-heading text-xl font-bold text-red-800"
          >
            {t.cancelled}
          </p>
        )}
        {job.status === "complete" && (
          <p className="mb-5 rounded-2xl border-2 border-brand-green/40 bg-brand-green-light px-4 py-3 text-center text-lg font-bold text-brand-green-dark">
            ✓ {t.completed}
          </p>
        )}

        <div className="space-y-4">
          <WhereCard job={job} t={t} />
          <WhenCard job={job} next={next} locale={locale} t={t} token={token} />
          <ContactCard job={job} t={t} />

          {job.instructions && (
            <Card title={t.instructions}>
              <p className="whitespace-pre-wrap text-lg leading-relaxed text-charcoal">
                {job.instructions}
              </p>
            </Card>
          )}

          <Card title={t.work}>
            {job.workItems.length === 0 ? (
              <p className="text-lg text-charcoal/45">{t.noWork}</p>
            ) : (
              <ul className="space-y-3">
                {job.workItems.map((item) => (
                  <li
                    key={item.id}
                    className={
                      item.kind === "text"
                        ? "text-lg italic leading-snug text-charcoal/65"
                        : "border-l-4 border-brand-blue/25 pl-3"
                    }
                  >
                    <p className="text-lg font-semibold leading-snug text-charcoal">{item.name}</p>
                    {item.description && (
                      <p className="mt-0.5 whitespace-pre-wrap text-base leading-snug text-charcoal/65">
                        {item.description}
                      </p>
                    )}
                    {item.kind === "item" && item.quantityMilli !== null && (
                      <p className="mt-0.5 text-base font-bold tabular-nums text-charcoal/55">
                        {formatQuantity(item.quantityMilli)}
                        {item.unit ? ` ${item.unit}` : ""}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title={t.checklist}>
            {job.checklistUnavailable ? (
              <p className="text-lg text-charcoal/45">{t.checklistUnavailable}</p>
            ) : job.checklist.length === 0 ? (
              <p className="text-lg text-charcoal/45">{t.noChecklist}</p>
            ) : (
              <CrewChecklist
                items={job.checklist}
                labels={{
                  markDone: t.markDone,
                  markNotDone: t.markNotDone,
                  doneTemplate: t.doneTemplate,
                  failed: t.failed,
                  visitDone: t.visitDone,
                  visitDoneUndo: t.visitDoneUndo,
                }}
                toggleAction={toggleChecklistItemAction.bind(null, token)}
              />
            )}
          </Card>

          <Card title={t.photos}>
            {job.photosUnavailable ? (
              <p className="text-lg text-charcoal/45">{t.photosUnavailable}</p>
            ) : job.photos.length === 0 ? (
              <p className="text-lg text-charcoal/45">{t.noPhotos}</p>
            ) : (
              <ul className="grid grid-cols-2 gap-3">
                {job.photos.map((photo) => (
                  <li key={photo.id}>
                    {photo.url ? (
                      <a
                        href={photo.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`${photo.note || photo.filename} — ${t.openPhoto}`}
                        className="block overflow-hidden rounded-xl border-2 border-black/10 bg-white"
                      >
                        {/* Plain <img>: these are short-lived signed Supabase
                            URLs on a host the image optimizer is not configured
                            for, and configuring it is a next.config change this
                            feature must not own. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photo.url}
                          alt={photo.note || photo.filename}
                          loading="lazy"
                          className="aspect-square w-full object-cover"
                        />
                        {photo.note && (
                          <span className="block px-2 py-1.5 text-sm font-semibold leading-snug text-charcoal/70">
                            {photo.note}
                          </span>
                        )}
                      </a>
                    ) : (
                      <span className="block rounded-xl border-2 border-dashed border-black/15 px-3 py-6 text-center text-sm font-semibold text-charcoal/40">
                        {photo.filename}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <p className="mt-6 text-center text-sm leading-relaxed text-charcoal/40">{t.noPrices}</p>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-charcoal/45">{title}</h2>
      {children}
    </section>
  );
}

function WhereCard({ job, t }: { job: CrewJobPayload; t: CrewCopy }) {
  const { site } = job;
  const lines = [site.street1, site.street2].filter(Boolean);
  const town = [site.city, site.province, site.postalCode].filter(Boolean).join(" ");

  return (
    <Card title={t.where}>
      {site.mapQuery ? (
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(site.mapQuery)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-[64px] items-center justify-between gap-3 rounded-xl border-2 border-brand-blue/30 bg-brand-blue-light px-4 py-3 transition-colors active:bg-brand-blue/15"
        >
          <span className="min-w-0">
            {lines.map((line) => (
              <span key={line} className="block font-heading text-xl font-bold leading-tight text-charcoal">
                {line}
              </span>
            ))}
            {town && <span className="block text-lg leading-snug text-charcoal/70">{town}</span>}
          </span>
          <span className="shrink-0 text-sm font-bold uppercase tracking-wide text-brand-blue">
            {t.openMaps}
          </span>
        </a>
      ) : (
        <p className="text-lg text-charcoal/45">—</p>
      )}

      {site.accessNotes && (
        <div className="mt-3 rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-wide text-amber-800/70">{t.access}</p>
          <p className="mt-1 whitespace-pre-wrap text-lg font-semibold leading-snug text-amber-900">
            {site.accessNotes}
          </p>
        </div>
      )}
    </Card>
  );
}

function WhenCard({
  job,
  next,
  locale,
  t,
  token,
}: {
  job: CrewJobPayload;
  next: CrewVisit | null;
  locale: CrewLocale;
  t: CrewCopy;
  token: string;
}) {
  const others = job.visits.filter((visit) => visit.id !== next?.id);

  return (
    <Card title={t.when}>
      {!next ? (
        <p className="text-lg text-charcoal/45">
          {job.startsOn ? formatDate(job.startsOn, locale) : t.noVisit}
        </p>
      ) : (
        <>
          <p className="font-heading text-xl font-bold capitalize leading-tight text-charcoal">
            {formatDay(next.startsAt, locale)}
          </p>
          <p className="mt-0.5 text-2xl font-bold tabular-nums text-brand-blue">
            {next.allDay
              ? t.allDay
              : `${formatTime(next.startsAt, locale)}${
                  next.endsAt ? ` – ${formatTime(next.endsAt, locale)}` : ""
                }`}
          </p>
          {next.title && <p className="mt-1 text-lg text-charcoal/70">{next.title}</p>}
          {next.notes && (
            <p className="mt-1 whitespace-pre-wrap text-base leading-snug text-charcoal/60">
              {next.notes}
            </p>
          )}

          <VisitDoneButton
            visit={next}
            labels={{
              markDone: t.markDone,
              markNotDone: t.markNotDone,
              doneTemplate: t.doneTemplate,
              failed: t.failed,
              visitDone: t.visitDone,
              visitDoneUndo: t.visitDoneUndo,
            }}
            toggleAction={toggleVisitDoneAction.bind(null, token)}
          />
        </>
      )}

      {others.length > 0 && (
        <ul className="mt-4 space-y-1 border-t border-black/5 pt-3">
          {others.map((visit) => (
            <li
              key={visit.id}
              className={`flex items-baseline gap-2 text-base ${
                visit.completedAt ? "text-charcoal/35 line-through" : "text-charcoal/60"
              }`}
            >
              <span className="capitalize">{formatDay(visit.startsAt, locale)}</span>
              {!visit.allDay && (
                <span className="tabular-nums">{formatTime(visit.startsAt, locale)}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function ContactCard({ job, t }: { job: CrewJobPayload; t: CrewCopy }) {
  const { firstName, phone } = job.contact;

  return (
    <Card title={t.contact}>
      {phone ? (
        <a
          href={`tel:${phone.replace(/[^\d+]/g, "")}`}
          className="flex min-h-[64px] items-center justify-between gap-3 rounded-xl border-2 border-brand-green bg-brand-green px-4 py-3 text-white transition-colors active:bg-brand-green-dark"
        >
          <span className="min-w-0">
            {firstName && (
              <span className="block font-heading text-xl font-bold leading-tight">{firstName}</span>
            )}
            <span className="block text-lg font-semibold tabular-nums">{phone}</span>
          </span>
          <span className="shrink-0 text-sm font-bold uppercase tracking-wide">{t.call}</span>
        </a>
      ) : (
        <p className="text-lg text-charcoal/45">
          {firstName ? `${firstName} — ` : ""}
          {t.noPhone}
        </p>
      )}
    </Card>
  );
}

function LangLink({
  token,
  locale,
  current,
}: {
  token: string;
  locale: CrewLocale;
  current: CrewLocale;
}) {
  const active = locale === current;
  return (
    <Link
      href={`/crew/${token}?lang=${locale}`}
      aria-current={active ? "true" : undefined}
      className={`rounded-full px-3 py-1.5 text-sm font-bold uppercase transition-colors ${
        active ? "bg-brand-blue text-white" : "text-charcoal/50"
      }`}
    >
      {locale === "fr" ? "FR" : "EN"}
    </Link>
  );
}
