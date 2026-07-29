-- Renovision AnA — lead storage.
--
-- Run this in the Supabase SQL editor once the project exists. The project
-- MUST be created in ca-central-1 (Montreal): region is chosen at creation and
-- cannot be changed afterwards, and keeping customer data in Quebec avoids a
-- cross-border transfer assessment for every lead.
--
-- Scope note: this is deliberately ONE table. Job management, scheduling and
-- invoicing are explicitly out of scope for the first build — that restraint is
-- the whole reason building beats buying here. The nullable claim_* and job_*
-- columns exist so those can be added later as data rather than as a migration
-- that rewrites everything; they are not populated by anything yet.

create table if not exists public.leads (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),

  -- Given by the customer.
  name            text not null,
  email           text not null,
  phone           text not null,
  address         text,
  locale          text not null default 'fr',

  -- Consent evidence. A bare boolean does not prove what was agreed to, and
  -- the burden of proof is ours, so the wording shown is stored verbatim.
  marketing_consent      boolean not null default false,
  consent_granted_at     timestamptz,
  consent_wording        text,
  consent_locale         text,
  consent_source         text,

  -- Derived by the estimator, kept separate from what the customer supplied so
  -- an access or portability request can be answered without hand-sorting.
  scope_summary       text,
  estimate_low        text,
  estimate_expected   text,
  estimate_high       text,
  estimate_lines      jsonb,
  estimate_exclusions jsonb,
  subtotal            text,
  gst                 text,
  qst                 text,
  total               text,
  total_labor_hours   numeric,
  estimated_work_days integer,

  -- Pipeline. Four values, deliberately: more states than you will actually
  -- maintain is how a pipeline stops reflecting reality.
  status          text not null default 'new'
                  check (status in ('new', 'contacted', 'quoted', 'won', 'lost')),
  notes           text,

  -- Reserved for later insurance work. Nullable and unused for now.
  claim_number    text,
  insurer         text,
  job_completed_at timestamptz
);

-- The list view is always "newest first", and status filtering follows.
create index if not exists leads_created_at_idx on public.leads (created_at desc);
create index if not exists leads_status_idx     on public.leads (status);

-- Lock the table down. Row Level Security is ON with no policies, which denies
-- everything by default. The anon and authenticated keys therefore cannot read
-- or write leads even if one leaks from the browser bundle.
--
-- Server-side inserts and the admin view use the service-role key, which
-- bypasses RLS and must NEVER be exposed to the client — server env var only.
alter table public.leads enable row level security;

-- Retention, per the published privacy policy: enquiries that never became
-- work are deleted after 24 months. Records tied to completed work are kept
-- (tax and construction-liability rules), which is why the delete is
-- conditional rather than a blanket age cutoff.
--
-- Not scheduled here. Enable pg_cron in Supabase and schedule it, or run it
-- manually — an unscheduled policy nobody executes is the same as no policy.
create or replace function public.purge_stale_leads()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  removed integer;
begin
  delete from public.leads
   where created_at < now() - interval '24 months'
     and job_completed_at is null
     and status in ('new', 'contacted', 'quoted', 'lost');
  get diagnostics removed = row_count;
  return removed;
end;
$$;
