import Link from "next/link";
import { notFound } from "next/navigation";
import {
  addPropertyAction,
  createHubLinkAction,
  removePropertyAction,
  revokeHubLinkAction,
  sendSmsAction,
  setArchivedAction,
  startEstimateForClientAction,
  startJobAction,
  updatePropertyAction,
} from "../actions";
import { bridgeCallAction } from "../../callActions";
import AdminNotice from "@/components/admin/AdminNotice";
import ArchiveToggleButton from "@/components/admin/ArchiveToggleButton";
import BusinessCallButton from "@/components/admin/BusinessCallButton";
import AskClaude from "@/components/admin/AskClaude";
import CallButton from "@/components/admin/CallButton";
import HubLink from "@/components/admin/HubLink";
import PropertyEditor from "@/components/admin/PropertyEditor";
import SmsThread from "@/components/admin/SmsThread";
import StartJobCard from "@/components/admin/StartJobCard";
import {
  AddLink,
  Card,
  ChatIcon,
  DocIcon,
  EmptyState,
  FolderIcon,
  HubList,
  HubRow,
  InboxIcon,
  MailIcon,
  PhoneIcon,
  PinIcon,
  QuickAction,
  ReceiptIcon,
  RulerIcon,
  SectionHeader,
  StatTile,
  WrenchIcon,
  type Tone,
} from "@/components/admin/ui/Hub";
import { SITE_URL } from "@/lib/constants";
import { getClient } from "@/lib/crm/clients";
import { MigrationPendingError } from "@/lib/crm/db";
import { listInsuranceEstimates, type InsuranceEstimateListItem } from "@/lib/crm/insuranceEstimates";
import { listInvoices } from "@/lib/crm/invoices";
import { listJobs } from "@/lib/crm/jobs";
import { formatMoney } from "@/lib/crm/money";
import { INVOICE_STATUS_LABEL, JOB_STATUS_LABEL, type InvoiceStatus, type JobStatus } from "@/lib/crm/opsTypes";
import { listProjects, PROJECT_STATUS_LABEL, type ProjectStatus } from "@/lib/crm/projects";
import { QUOTE_STATUS_LABEL, type QuoteStatus } from "@/lib/crm/quoteTypes";
import { listQuotes } from "@/lib/crm/quotes";
import { formatRate, getTaxRates, resolveTaxRate } from "@/lib/crm/settings";
import { listLeads } from "@/lib/leadStore";
import { listThread } from "@/lib/sms/thread";
import {
  clientDisplayName,
  clientPersonName,
  formatAddress,
  primaryPhone,
  type ClientWithProperties,
} from "@/lib/crm/types";

export const dynamic = "force-dynamic";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let client: ClientWithProperties | null;
  try {
    client = await getClient(id);
  } catch (err) {
    if (err instanceof MigrationPendingError) {
      return (
        <AdminNotice title="One migration left to run">
          Run{" "}
          <code className="font-mono text-brand-blue">
            supabase/migrations/0004_clients_properties.sql
          </code>{" "}
          in the Supabase SQL editor.
        </AdminNotice>
      );
    }
    throw err;
  }

  if (!client) notFound();

  // Texts hang off the number, not the client row — see lib/sms/thread.ts. The
  // thread is read even when it is empty so the composer is there before the
  // first message rather than appearing only once one exists. A client with no
  // phone at all gets no panel, which is the honest thing to show.
  const textablePhone = primaryPhone(client);
  const thread = await listThread(textablePhone).catch(() => ({
    messages: [],
    optedOut: false,
  }));

  const taxRates = await getTaxRates();
  const effectiveRate = resolveTaxRate(taxRates, client.tax_rate_id);
  const person = clientPersonName(client);
  const billing = formatAddress({
    street1: client.billing_street1,
    street2: client.billing_street2,
    city: client.billing_city,
    province: client.billing_province,
    postal_code: client.billing_postal_code,
  });

  // Everything the hub lists, read side by side. Each list fails on its own:
  // a table whose migration has not run costs that section, not the page.
  const safe = <T,>(p: Promise<T[]>): Promise<T[]> => p.catch(() => [] as T[]);
  const [leads, estimates, quotes, projects, jobs, invoices] = await Promise.all([
    safe(listLeads(50, client.id)),
    safe<InsuranceEstimateListItem>(listInsuranceEstimates({ clientId: client.id, limit: 50 })),
    safe(listQuotes({ clientId: client.id, limit: 50 })),
    safe(listProjects({ clientId: client.id, limit: 50 })),
    safe(listJobs({ clientId: client.id, limit: 50 })),
    safe(listInvoices({ clientId: client.id, limit: 50 })),
  ]);

  // The summary strip. "Open" means still in play: a draft estimate, a quote
  // the customer has not answered, a job not finished, an invoice not paid.
  const OPEN_QUOTE: QuoteStatus[] = ["draft", "sent", "viewed", "changes_requested"];
  const openEstimateCents =
    estimates.filter((e) => e.status === "draft").reduce((sum, e) => sum + e.total_cents, 0) +
    quotes.filter((q) => OPEN_QUOTE.includes(q.status)).reduce((sum, q) => sum + q.total_cents, 0);
  const activeJobs = jobs.filter((j) => ["unscheduled", "scheduled", "in_progress"].includes(j.status)).length;
  const owingCents = invoices
    .filter((i) => ["sent", "viewed", "part_paid"].includes(i.status))
    .reduce((sum, i) => sum + Math.max(0, i.total_cents - i.amount_paid_cents), 0);

  const primaryEmail = client.emails.find((e) => e.primary)?.address ?? client.emails[0]?.address ?? null;
  const siteAddress =
    client.properties
      .map((p) => formatAddress({ street1: p.street1, street2: p.street2, city: p.city, province: p.province, postal_code: p.postal_code }))
      .find(Boolean) || billing;
  const propertyOptions = client.properties.map((property) => ({
    id: property.id,
    label:
      formatAddress({
        street1: property.street1,
        street2: property.street2,
        city: property.city,
        province: property.province,
        postal_code: property.postal_code,
      }) || "Property",
  }));
  const archived = Boolean(client.archived_at);

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <Link
        href="/admin/clients"
        className="inline-flex items-center gap-1 text-sm font-semibold text-charcoal/50 transition-colors hover:text-charcoal"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
          <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Clients
      </Link>

      {/* Header: who, then the four things you do with a client without
          opening anything — call, text, email, drive there. */}
      <Card className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-blue text-base font-bold text-white">
            {initials(clientDisplayName(client))}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-heading text-xl font-bold text-charcoal">{clientDisplayName(client)}</h1>
            {person && <p className="truncate text-sm text-charcoal/55">{person}</p>}
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {client.lead_source && <Chip>{client.lead_source}</Chip>}
              {client.tags.map((tag) => (
                <Chip key={tag} accent>
                  {tag}
                </Chip>
              ))}
              {archived && <Chip>Archived</Chip>}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Link
              href={`/admin/clients/${client.id}/edit`}
              className="rounded-lg border border-black/10 px-3 py-1.5 text-sm font-bold text-charcoal transition-colors hover:bg-black/[0.03]"
            >
              Edit
            </Link>
            {/* The overflow: things done rarely enough not to earn a button. */}
            <details className="relative">
              <summary
                aria-label="More actions"
                className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-lg border border-black/10 text-charcoal/60 hover:bg-black/[0.03] [&::-webkit-details-marker]:hidden"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <circle cx="5" cy="12" r="1.8" />
                  <circle cx="12" cy="12" r="1.8" />
                  <circle cx="19" cy="12" r="1.8" />
                </svg>
              </summary>
              <div className="absolute right-0 z-20 mt-1 w-44 rounded-xl border border-black/10 bg-white p-1.5 shadow-lg">
                <form action={setArchivedAction.bind(null, client.id, !archived)}>
                  <ArchiveToggleButton archived={archived} />
                </form>
              </div>
            </details>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-4 gap-2 border-t border-black/[0.05] pt-4">
          <QuickAction href={textablePhone ? `tel:${textablePhone}` : null} label="Call" icon={<PhoneIcon />} />
          <QuickAction href={textablePhone ? "#messages" : null} label="Text" icon={<ChatIcon />} />
          <QuickAction href={primaryEmail ? `mailto:${primaryEmail}` : null} label="Email" icon={<MailIcon />} />
          <QuickAction
            href={siteAddress ? `https://maps.apple.com/?q=${encodeURIComponent(siteAddress.replaceAll(" · ", ", "))}` : null}
            label="Directions"
            icon={<PinIcon />}
            external
          />
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <StatTile label="Open estimates" value={formatMoney(openEstimateCents)} />
          <StatTile label="Active jobs" value={String(activeJobs)} />
          <StatTile label="Owing" value={formatMoney(owingCents)} tone={owingCents > 0 ? "red" : undefined} />
        </div>
      </Card>

      {/* Create: the pipeline's first moves, from here. */}
      {!archived && (
        <Card className="p-4 sm:p-5">
          <h2 className="font-heading text-[15px] font-bold text-charcoal">Start something</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <form action={startEstimateForClientAction.bind(null, client.id)} className="contents">
              {propertyOptions.length > 1 && (
                <select
                  name="propertyId"
                  aria-label="Property for the estimate"
                  className="rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm sm:col-span-3"
                  defaultValue={propertyOptions[0].id}
                >
                  {propertyOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      Estimate for {p.label}
                    </option>
                  ))}
                </select>
              )}
              <button
                type="submit"
                className="flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-brand-blue px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-blue/90"
              >
                <RulerIcon />
                New estimate
              </button>
            </form>
            <Link
              href={`/admin/quotes/new?client=${client.id}`}
              className="flex items-center justify-center gap-2 rounded-xl border border-black/10 px-4 py-3 text-sm font-bold text-charcoal transition-colors hover:bg-black/[0.03]"
            >
              <DocIcon />
              New quote
            </Link>
            <Link
              href={`/admin/projects/new?client=${client.id}`}
              className="flex items-center justify-center gap-2 rounded-xl border border-black/10 px-4 py-3 text-sm font-bold text-charcoal transition-colors hover:bg-black/[0.03]"
            >
              <FolderIcon />
              New project
            </Link>
          </div>
          <p className="mt-2 text-xs text-charcoal/45">
            New estimate opens the insurance estimator on a new project for this client
            {propertyOptions.length === 1 ? `, at ${propertyOptions[0].label}` : ""}.
          </p>
        </Card>
      )}

      {/* Requests: the leads this client came from. */}
      <Card>
        <SectionHeader icon={<InboxIcon />} title="Requests" count={leads.length} />
        {leads.length === 0 ? (
          <EmptyState>No requests on file. Leads that convert to this client show here.</EmptyState>
        ) : (
          <HubList>
            {leads.map((lead) => (
              <HubRow
                key={lead.id}
                href="/admin/leads"
                title={lead.scope_summary?.split("\n")[0] || lead.name}
                subtitle={lead.address}
                status={{ tone: LEAD_TONE[lead.status] ?? "grey", label: lead.status }}
                amount={lead.total || null}
                meta={shortDate(lead.created_at)}
              />
            ))}
          </HubList>
        )}
      </Card>

      {/* Estimates: the insurance estimator's documents. */}
      <Card>
        <SectionHeader
          icon={<RulerIcon />}
          title="Estimates"
          count={estimates.length}
          action={<AddLink href="/admin/estimates">All estimates</AddLink>}
        />
        {estimates.length === 0 ? (
          <EmptyState>No estimates yet. “New estimate” above starts one.</EmptyState>
        ) : (
          <HubList>
            {estimates.map((estimate) => (
              <HubRow
                key={estimate.id}
                href={`/admin/projects/${estimate.project_id}/estimate`}
                title={estimate.title || estimate.project_name}
                subtitle={[estimate.project_name, estimate.address].filter(Boolean).join(" · ")}
                status={
                  estimate.status === "final"
                    ? { tone: "green", label: "Final" }
                    : { tone: "amber", label: "Draft" }
                }
                amount={formatMoney(estimate.total_cents)}
                meta={`${estimate.line_count} lines · ${shortDate(estimate.updated_at)}`}
              />
            ))}
          </HubList>
        )}
      </Card>

      <Card>
        <SectionHeader
          icon={<DocIcon />}
          title="Quotes"
          count={quotes.length}
          action={!archived && <AddLink href={`/admin/quotes/new?client=${client.id}`}>New</AddLink>}
        />
        {quotes.length === 0 ? (
          <EmptyState>No quotes yet.</EmptyState>
        ) : (
          <HubList>
            {quotes.map((quote) => (
              <HubRow
                key={quote.id}
                href={`/admin/quotes/${quote.id}`}
                title={`#${quote.quote_number}${quote.title ? ` · ${quote.title}` : ""}`}
                status={{ tone: QUOTE_TONE[quote.status], label: QUOTE_STATUS_LABEL[quote.status] }}
                amount={formatMoney(quote.total_cents)}
                meta={shortDate(quote.updated_at)}
              />
            ))}
          </HubList>
        )}
      </Card>

      <Card>
        <SectionHeader
          icon={<FolderIcon />}
          title="Projects"
          count={projects.length}
          action={!archived && <AddLink href={`/admin/projects/new?client=${client.id}`}>New</AddLink>}
        />
        {projects.length === 0 ? (
          <EmptyState>No projects yet.</EmptyState>
        ) : (
          <HubList>
            {projects.map((project) => (
              <HubRow
                key={project.id}
                href={`/admin/projects/${project.id}`}
                title={project.name}
                subtitle={[project.address_line1, project.address_city].filter(Boolean).join(", ") || null}
                status={{ tone: PROJECT_TONE[project.status], label: PROJECT_STATUS_LABEL[project.status] }}
                meta={`${project.room_count} rooms · ${project.file_count} files`}
              />
            ))}
          </HubList>
        )}
      </Card>

      <Card>
        <SectionHeader icon={<WrenchIcon />} title="Jobs" count={jobs.length} />
        {jobs.length === 0 ? (
          <EmptyState>No jobs yet. Approve a quote, or start one below.</EmptyState>
        ) : (
          <HubList>
            {jobs.map((job) => (
              <HubRow
                key={job.id}
                href={`/admin/jobs/${job.id}`}
                title={`#${job.job_number}${job.title ? ` · ${job.title}` : ""}`}
                subtitle={job.visit_count ? `${job.visit_count} visit${job.visit_count === 1 ? "" : "s"}` : null}
                status={{ tone: JOB_TONE[job.status], label: JOB_STATUS_LABEL[job.status] }}
                amount={job.total_cents ? formatMoney(job.total_cents) : null}
                meta={job.starts_on ? shortDate(job.starts_on) : null}
              />
            ))}
          </HubList>
        )}
      </Card>

      {/* Sits with the jobs: work agreed on the phone is the common case, and
          it does not start with a quote. */}
      {!archived && <StartJobCard properties={propertyOptions} action={startJobAction.bind(null, client.id)} />}

      <Card>
        <SectionHeader icon={<ReceiptIcon />} title="Invoices" count={invoices.length} />
        {invoices.length === 0 ? (
          <EmptyState>No invoices yet. A finished job makes one.</EmptyState>
        ) : (
          <HubList>
            {invoices.map((invoice) => {
              const balance = Math.max(0, invoice.total_cents - invoice.amount_paid_cents);
              return (
                <HubRow
                  key={invoice.id}
                  href={`/admin/invoices/${invoice.id}`}
                  title={`#${invoice.invoice_number}${invoice.title ? ` · ${invoice.title}` : ""}`}
                  subtitle={balance > 0 && invoice.status !== "draft" ? `${formatMoney(balance)} owing` : null}
                  status={{ tone: INVOICE_TONE[invoice.status], label: INVOICE_STATUS_LABEL[invoice.status] }}
                  amount={formatMoney(invoice.total_cents)}
                  meta={shortDate(invoice.issue_date)}
                />
              );
            })}
          </HubList>
        )}
      </Card>

      <PropertyEditor
        properties={client.properties}
        taxRates={taxRates}
        addAction={addPropertyAction.bind(null, client.id)}
        updateAction={updatePropertyAction.bind(null, client.id)}
        removeAction={removePropertyAction.bind(null, client.id)}
      />

      {textablePhone && (
        <div id="messages" className="scroll-mt-20">
          <SmsThread
            phone={textablePhone}
            messages={thread.messages}
            optedOut={thread.optedOut}
            action={sendSmsAction.bind(null, client.id, textablePhone)}
          />
        </div>
      )}

      {/* Contact details and notes: the record itself, below the work. */}
      <Card className="p-4 sm:p-5">
        <h2 className="font-heading text-[15px] font-bold text-charcoal">Contact details</h2>
        <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <Row label="Email">
            {client.emails.length === 0 ? (
              <span className="text-charcoal/35">—</span>
            ) : (
              <ul className="space-y-0.5">
                {client.emails.map((email) => (
                  <li key={email.address}>
                    <a
                      href={`mailto:${email.address}`}
                      className="font-medium text-brand-blue hover:underline"
                    >
                      {email.address}
                    </a>
                    <span className="ml-1.5 text-[11px] uppercase tracking-wide text-charcoal/35">
                      {email.type}
                      {email.primary ? " · primary" : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Row>

          <Row label="Phone">
            {client.phones.length === 0 ? (
              <span className="text-charcoal/35">—</span>
            ) : (
              <ul className="space-y-2">
                {client.phones.map((phone) => (
                  <li key={phone.number} className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-charcoal/85">{phone.number}</span>
                    <span className="text-[11px] uppercase tracking-wide text-charcoal/35">
                      {phone.type}
                      {phone.smsAllowed ? " · sms ok" : ""}
                    </span>
                    {/* Two ways to place the same call, and the difference is
                        whose number the customer keeps. See both components'
                        headers — neither is a replacement for the other. */}
                    <CallButton phone={phone.number} label="From my phone" className="px-3 py-1 text-xs" />
                    <BusinessCallButton
                      phone={phone.number}
                      action={bridgeCallAction}
                      className="px-3 py-1 text-xs"
                    />
                  </li>
                ))}
              </ul>
            )}
          </Row>

          <Row label="Billing address">{billing || <span className="text-charcoal/35">—</span>}</Row>

          <Row label="Tax rate">
            {effectiveRate.label} · {formatRate(effectiveRate)}
            {!client.tax_rate_id && (
              <span className="ml-1.5 text-[11px] text-charcoal/40">(account default)</span>
            )}
          </Row>
        </dl>

        {client.notes && (
          <div className="mt-4 border-t border-black/5 pt-4">
            <span className="text-xs font-semibold text-charcoal/70">Notes</span>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-charcoal/75">
              {client.notes}
            </p>
          </div>
        )}
      </Card>

      <HubLink
        url={
          (client as { hub_token?: string | null }).hub_token
            ? `${SITE_URL}/hub/${(client as { hub_token?: string | null }).hub_token}`
            : null
        }
        createAction={createHubLinkAction.bind(null, client.id)}
        revokeAction={revokeHubLinkAction.bind(null, client.id)}
      />

      <AskClaude subject={{ kind: "client", id: client.id }} />
    </div>
  );
}

const QUOTE_TONE: Record<QuoteStatus, Tone> = {
  draft: "grey",
  sent: "blue",
  viewed: "blue",
  approved: "green",
  changes_requested: "amber",
  declined: "red",
  converted: "green",
};
const JOB_TONE: Record<JobStatus, Tone> = {
  unscheduled: "amber",
  scheduled: "blue",
  in_progress: "blue",
  complete: "green",
  cancelled: "grey",
};
const INVOICE_TONE: Record<InvoiceStatus, Tone> = {
  draft: "grey",
  sent: "blue",
  viewed: "blue",
  part_paid: "amber",
  paid: "green",
  bad_debt: "red",
};
const PROJECT_TONE: Record<ProjectStatus, Tone> = {
  active: "blue",
  on_hold: "amber",
  done: "green",
  archived: "grey",
};
const LEAD_TONE: Record<string, Tone> = {
  new: "amber",
  contacted: "blue",
  quoted: "blue",
  won: "green",
  lost: "grey",
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

/** "Nov 4" this year, "Nov 4, 2025" otherwise. Date-only strings are read
    at noon so a time zone cannot move them a day. */
function shortDate(value: string): string {
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value);
  if (Number.isNaN(date.getTime())) return "";
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString("en-CA", { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) });
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold text-charcoal/70">{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-charcoal/80">{children}</dd>
    </div>
  );
}

function Chip({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        accent ? "bg-brand-blue/[0.08] text-brand-blue" : "bg-black/[0.05] text-charcoal/60"
      }`}
    >
      {children}
    </span>
  );
}
