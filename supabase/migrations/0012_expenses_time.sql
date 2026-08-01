-- Renovision AnA — expenses and time entries.
--
-- What the work COSTS. Everything up to here tracks what a job is worth —
-- quotes, invoices, payments. None of it says whether the job made money,
-- because the receipts from the building-supply counter and the hours the
-- crew stood in the house were never written down anywhere the invoice
-- could meet them. These two tables are that other half of the ledger.
--
-- Requires 0007 (jobs). Run them in order.

-- ---------------------------------------------------------------------------
-- Expenses
-- ---------------------------------------------------------------------------
--
-- One row per receipt, not a running total per job. A total can't answer
-- "what did we spend at the lumber yard in June", and June is exactly when
-- the accountant asks.

create table if not exists public.expenses (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Nullable on purpose: fuel, insurance and shop consumables are real money
  -- with no job to charge. Forcing a job here would push overhead onto
  -- whichever job happened to be open, and quietly lie about every margin.
  -- SET NULL rather than cascade for the usual reason — money spent is a
  -- financial record, and purging a job must not erase it.
  job_id uuid references public.jobs (id) on delete set null,

  -- Where the money went. Free text; the business buys from a dozen counters
  -- and a vendors table would be ceremony.
  vendor      text,
  description text not null,

  -- A short fixed list, because a free-text category produces "Materials",
  -- "materials" and "matériaux" and then no report groups anything.
  category text not null default 'materials'
           check (category in ('materials','subcontractor','equipment','fuel','permits','disposal','other')),

  -- Integer cents, same discipline as every other amount in this database.
  -- Signed: a negative expense is a refund or a returned item, exactly as a
  -- negative payment is a refund on an invoice.
  amount_cents integer not null,

  -- When the money left, not when it was typed in. Receipts get entered in
  -- batches days later, and the report month must follow the receipt.
  incurred_on date not null default current_date
);

create index if not exists expenses_job_idx      on public.expenses (job_id);
create index if not exists expenses_date_idx     on public.expenses (incurred_on desc);
create index if not exists expenses_category_idx on public.expenses (category);

alter table public.expenses enable row level security;

-- ---------------------------------------------------------------------------
-- Time entries
-- ---------------------------------------------------------------------------
--
-- One row per person per day per job. Not clock-in/clock-out — nobody on a
-- reno crew punches a clock mid-demolition — the foreman writes "Marc, 7.5
-- hours, the Tremblay kitchen" at the end of the day, and this table is that
-- sentence as a row.

create table if not exists public.time_entries (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- NOT NULL, unlike expenses: hours are only ever worked ON something, and
  -- an unattributed hour has no meaning a report could use. CASCADE like
  -- visits — the job's calendar and its timesheet share its lifetime.
  job_id uuid not null references public.jobs (id) on delete cascade,

  -- Free text, no staff table. The crew is a handful of names the owner
  -- knows; an employees module would be more system than the business.
  person text not null,

  -- Integer minutes, for the same reason money is integer cents: "7.5 hours"
  -- as a float invites drift, and 450 minutes is exact. The UI speaks hours
  -- and converts at the edge.
  minutes integer not null check (minutes > 0),

  worked_on date not null default current_date,
  note text
);

create index if not exists time_entries_job_idx  on public.time_entries (job_id);
create index if not exists time_entries_date_idx on public.time_entries (worked_on desc);

alter table public.time_entries enable row level security;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

grant all on public.expenses     to service_role;
grant all on public.time_entries to service_role;

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------

drop trigger if exists expenses_touch_updated_at on public.expenses;
create trigger expenses_touch_updated_at before update on public.expenses
  for each row execute function public.touch_updated_at();

drop trigger if exists time_entries_touch_updated_at on public.time_entries;
create trigger time_entries_touch_updated_at before update on public.time_entries
  for each row execute function public.touch_updated_at();
