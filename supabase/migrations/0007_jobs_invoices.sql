-- Renovision AnA — jobs, visits, invoices and payments.
--
-- The work half of the system. A quote is an offer; a job is the commitment
-- to do it; an invoice is the demand for payment. Each is a separate record
-- with its own lifetime, because they answer different questions and get
-- amended at different times.
--
-- Same three principles as 0006: integer cents, sent documents are frozen,
-- and Quebec's document requirements are columns rather than reminders.
--
-- One rule this migration adds: LINE ITEMS ARE COPIED, NEVER JOINED. A job's
-- lines are copied from the quote and an invoice's from the job. Editing a
-- quote after the job started must not silently change what is being built,
-- and re-pricing a job must not rewrite an invoice already sent. Three tables
-- with the same shape is the cost of that guarantee, and it is worth paying.

-- ---------------------------------------------------------------------------
-- Numbering
-- ---------------------------------------------------------------------------
-- Sequences, for the same reason quotes use one: a read-then-increment in
-- application code double-issues on a double submit, and two invoices sharing
-- a number is the sort of thing an auditor finds.

create sequence if not exists public.job_number_seq     start 1000;
create sequence if not exists public.invoice_number_seq start 1000;

-- ---------------------------------------------------------------------------
-- Jobs
-- ---------------------------------------------------------------------------

create table if not exists public.jobs (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  job_number integer not null default nextval('public.job_number_seq') unique,

  -- RESTRICT for the same reason as quotes: a job is a financial record and
  -- must not be destroyed as a side effect of purging a client.
  client_id   uuid not null references public.clients (id) on delete restrict,
  property_id uuid references public.properties (id) on delete set null,
  -- SET NULL: the quote may be archived or purged later, and the job carries
  -- its own copy of everything it needs.
  quote_id    uuid references public.quotes (id) on delete set null,

  title        text,
  -- What the crew needs to know on site. Distinct from internal_notes, which
  -- is commercial and never leaves the office.
  instructions   text,
  internal_notes text,

  -- unscheduled — accepted, no date yet
  -- scheduled   — has at least one visit in the future
  -- in_progress — work has started
  -- complete    — finished, ready to invoice
  -- cancelled   — called off
  status text not null default 'unscheduled'
         check (status in ('unscheduled','scheduled','in_progress','complete','cancelled')),

  job_type text not null default 'one_off' check (job_type in ('one_off','recurring')),

  starts_on date,
  ends_on   date,

  -- Frozen copies, same pattern as quotes.
  tax_snapshot      jsonb,
  client_snapshot   jsonb,
  property_snapshot jsonb,

  -- Carried from the quote so the job knows what it is worth without
  -- re-reading a document that may since have been archived.
  subtotal_cents integer not null default 0,
  discount_cents integer not null default 0,
  tax_cents      integer not null default 0,
  total_cents    integer not null default 0,

  -- Set when the work is signed off. Distinct from status so "when did we
  -- finish" survives a later status correction.
  completed_at timestamptz,
  archived_at  timestamptz,

  custom jsonb not null default '{}'::jsonb
);

create index if not exists jobs_client_idx  on public.jobs (client_id);
create index if not exists jobs_status_idx  on public.jobs (status);
create index if not exists jobs_starts_idx  on public.jobs (starts_on);
create index if not exists jobs_updated_idx on public.jobs (updated_at desc);

alter table public.jobs enable row level security;

create table if not exists public.job_line_items (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  job_id   uuid not null references public.jobs (id) on delete cascade,
  position integer not null default 0,
  kind     text not null default 'item' check (kind in ('item','text')),

  name        text not null,
  description text,

  quantity_milli   integer,
  unit             text,
  unit_cost_cents  integer,
  unit_price_cents integer,
  taxable  boolean not null default true,
  -- Optional lines arrive already resolved: an option the customer declined
  -- is simply not copied onto the job. Kept as columns anyway so the job's
  -- lines and the quote's lines stay structurally identical, which is what
  -- makes generating an invoice from either of them one code path.
  optional boolean not null default false,
  selected boolean not null default false,

  labor_hours numeric,
  price_book_item_id uuid references public.price_book_items (id) on delete set null,

  constraint job_line_shape check (
    (kind = 'text' and quantity_milli is null and unit_price_cents is null and unit_cost_cents is null)
    or
    (kind = 'item' and quantity_milli is not null and unit_price_cents is not null)
  )
);

create index if not exists job_lines_job_idx on public.job_line_items (job_id, position);
alter table public.job_line_items enable row level security;

-- ---------------------------------------------------------------------------
-- Visits — the calendar
-- ---------------------------------------------------------------------------
--
-- A job can need several trips: assessment, demolition, drying, finishing.
-- Modelling those as one date range on the job would lose the gaps, and the
-- gaps are exactly what the schedule has to show.

create table if not exists public.visits (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  job_id uuid not null references public.jobs (id) on delete cascade,

  title text,

  -- timestamptz, stored UTC, rendered in America/Toronto. A naive timestamp
  -- would shift by an hour twice a year, which on a schedule means turning up
  -- at the wrong time on the last Sunday in March.
  starts_at timestamptz not null,
  ends_at   timestamptz,
  -- An all-day visit has no meaningful clock time; the flag stops the UI
  -- rendering "00:00" and implying midnight.
  all_day   boolean not null default false,

  completed_at timestamptz,
  notes        text
);

create index if not exists visits_job_idx    on public.visits (job_id);
create index if not exists visits_starts_idx on public.visits (starts_at);

alter table public.visits enable row level security;

-- ---------------------------------------------------------------------------
-- Invoices
-- ---------------------------------------------------------------------------

create table if not exists public.invoices (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  invoice_number integer not null default nextval('public.invoice_number_seq') unique,

  client_id   uuid not null references public.clients (id) on delete restrict,
  property_id uuid references public.properties (id) on delete set null,
  job_id      uuid references public.jobs (id) on delete set null,
  quote_id    uuid references public.quotes (id) on delete set null,

  title text,

  -- draft     — being prepared
  -- sent      — issued to the customer
  -- viewed    — customer opened the link
  -- part_paid — some money received, balance outstanding
  -- paid      — settled
  -- bad_debt  — written off
  status text not null default 'draft'
         check (status in ('draft','sent','viewed','part_paid','paid','bad_debt')),

  -- A deposit invoice bills part of a job up front. Flagged rather than
  -- inferred from the amount, because "half the total" and "a deposit" are
  -- different facts and only one of them is a promise about the rest.
  is_deposit boolean not null default false,

  issue_date date not null default current_date,
  due_date   date,

  tax_rate_id  text,
  tax_snapshot jsonb,

  discount_kind  text not null default 'none' check (discount_kind in ('none','amount','percent')),
  discount_value integer not null default 0 check (discount_value >= 0),

  subtotal_cents integer not null default 0,
  discount_cents integer not null default 0,
  tax_cents      integer not null default 0,
  total_cents    integer not null default 0,
  -- Maintained by a trigger from the payments table, so it can never drift
  -- from the payments that actually exist.
  amount_paid_cents integer not null default 0,

  client_snapshot   jsonb,
  property_snapshot jsonb,

  client_message text,
  payment_terms  text,
  internal_notes text,

  show_quantities    boolean not null default true,
  show_unit_prices   boolean not null default true,
  show_line_totals   boolean not null default true,
  show_totals_footer boolean not null default true,

  -- Charter of the French Language s. 57: "Les factures, les reçus, les
  -- quittances et les autres documents de même nature sont rédigés en
  -- français." A non-French version may only be sent where the French one is
  -- accessible to the recipient on terms at least as favourable — so French is
  -- the default, not a preference.
  language text not null default 'fr' check (language in ('fr','en')),

  sent_at   timestamptz,
  viewed_at timestamptz,
  paid_at   timestamptz,

  public_token text unique,
  archived_at  timestamptz,

  custom jsonb not null default '{}'::jsonb
);

create index if not exists invoices_client_idx on public.invoices (client_id);
create index if not exists invoices_status_idx on public.invoices (status);
create index if not exists invoices_due_idx    on public.invoices (due_date);
create index if not exists invoices_token_idx  on public.invoices (public_token);

alter table public.invoices enable row level security;

create table if not exists public.invoice_line_items (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  invoice_id uuid not null references public.invoices (id) on delete cascade,
  position   integer not null default 0,
  kind       text not null default 'item' check (kind in ('item','text')),

  name        text not null,
  description text,

  quantity_milli   integer,
  unit             text,
  unit_cost_cents  integer,
  unit_price_cents integer,
  taxable  boolean not null default true,
  optional boolean not null default false,
  selected boolean not null default false,

  labor_hours numeric,
  price_book_item_id uuid references public.price_book_items (id) on delete set null,

  constraint invoice_line_shape check (
    (kind = 'text' and quantity_milli is null and unit_price_cents is null and unit_cost_cents is null)
    or
    (kind = 'item' and quantity_milli is not null and unit_price_cents is not null)
  )
);

create index if not exists invoice_lines_invoice_idx on public.invoice_line_items (invoice_id, position);
alter table public.invoice_line_items enable row level security;

-- ---------------------------------------------------------------------------
-- Payments
-- ---------------------------------------------------------------------------
--
-- Individual receipts, not a running total on the invoice. A customer paying
-- a deposit and then two instalments is three facts with three dates, and
-- collapsing them into one number loses the ability to answer "when did they
-- actually pay" — which is the question that matters when chasing money.

create table if not exists public.payments (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  invoice_id uuid not null references public.invoices (id) on delete cascade,

  -- Signed: a negative payment is a refund. Same reasoning as a negative line
  -- price — the alternative is a second table that behaves identically.
  amount_cents integer not null,

  method text not null default 'e_transfer'
         check (method in ('cash','cheque','e_transfer','card','bank_transfer','other')),

  received_on date not null default current_date,
  -- Cheque number, e-transfer confirmation, terminal reference.
  reference text,
  notes     text
);

create index if not exists payments_invoice_idx on public.payments (invoice_id);
create index if not exists payments_date_idx    on public.payments (received_on);

alter table public.payments enable row level security;

-- ---------------------------------------------------------------------------
-- Keep amount_paid_cents honest
-- ---------------------------------------------------------------------------
--
-- Derived in the database rather than by the application. An application that
-- forgets to recalculate after one code path leaves an invoice reading "paid"
-- when it is not, and that error is invisible until somebody is chased for
-- money they already sent.

create or replace function public.sync_invoice_paid()
returns trigger
language plpgsql
as $$
declare
  target uuid := coalesce(new.invoice_id, old.invoice_id);
  paid   integer;
  total  integer;
begin
  select coalesce(sum(amount_cents), 0) into paid
    from public.payments where invoice_id = target;

  select total_cents into total from public.invoices where id = target;

  update public.invoices
     set amount_paid_cents = paid,
         -- Only these three statuses are payment-derived. A draft stays a
         -- draft, and a written-off debt stays written off until a human says
         -- otherwise.
         status = case
           when status in ('draft','bad_debt') then status
           when paid >= total and total > 0 then 'paid'
           when paid > 0 then 'part_paid'
           else 'sent'
         end,
         paid_at = case
           when paid >= total and total > 0 then coalesce(paid_at, now())
           else null
         end
   where id = target;

  return null;
end;
$$;

drop trigger if exists payments_sync_invoice on public.payments;
create trigger payments_sync_invoice
  after insert or update or delete on public.payments
  for each row execute function public.sync_invoice_paid();

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

grant all on public.jobs               to service_role;
grant all on public.job_line_items     to service_role;
grant all on public.visits             to service_role;
grant all on public.invoices           to service_role;
grant all on public.invoice_line_items to service_role;
grant all on public.payments           to service_role;
grant usage, select on sequence public.job_number_seq     to service_role;
grant usage, select on sequence public.invoice_number_seq to service_role;

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------

drop trigger if exists jobs_touch_updated_at on public.jobs;
create trigger jobs_touch_updated_at before update on public.jobs
  for each row execute function public.touch_updated_at();

drop trigger if exists job_lines_touch_updated_at on public.job_line_items;
create trigger job_lines_touch_updated_at before update on public.job_line_items
  for each row execute function public.touch_updated_at();

drop trigger if exists visits_touch_updated_at on public.visits;
create trigger visits_touch_updated_at before update on public.visits
  for each row execute function public.touch_updated_at();

drop trigger if exists invoices_touch_updated_at on public.invoices;
create trigger invoices_touch_updated_at before update on public.invoices
  for each row execute function public.touch_updated_at();

drop trigger if exists invoice_lines_touch_updated_at on public.invoice_line_items;
create trigger invoice_lines_touch_updated_at before update on public.invoice_line_items
  for each row execute function public.touch_updated_at();

drop trigger if exists payments_touch_updated_at on public.payments;
create trigger payments_touch_updated_at before update on public.payments
  for each row execute function public.touch_updated_at();
