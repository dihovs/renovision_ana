-- Renovision AnA — the automated follow-up log.
--
-- One row per follow-up email the cron has sent: a nudge on a quote that got
-- no response, or a payment reminder on an overdue invoice. The table exists
-- for one reason — IDEMPOTENCY LIVES IN THE SCHEMA, NOT IN APPLICATION CODE.
-- A cron that runs daily and decides "already sent?" by re-deriving state in
-- JavaScript will, sooner or later, send a customer the same reminder twice:
-- a redeploy mid-run, two overlapping invocations, a clock that disagrees
-- with the database. The unique indexes below make the second attempt a
-- constraint violation instead of a second email.
--
-- The sender therefore INSERTS HERE FIRST and emails second. The failure mode
-- that leaves is a crashed run skipping a follow-up (row written, email never
-- left) — which costs one polite nudge. The opposite ordering risks charging
-- a customer's patience twice, and of the two failures only one is visible to
-- them.

create table if not exists public.followup_log (
  id         uuid primary key default gen_random_uuid(),

  -- quote_followup     — nudge on a sent quote with no response
  -- invoice_reminder_1 — first payment reminder on an overdue invoice
  -- invoice_reminder_2 — second (and last) payment reminder
  kind       text not null
             check (kind in ('quote_followup','invoice_reminder_1','invoice_reminder_2')),

  -- CASCADE, unlike the financial records themselves: this row is derivative.
  -- When the retention purge or a deliberate delete removes the document,
  -- "we nudged them about it once" has nothing left to be true about.
  quote_id   uuid references public.quotes (id)   on delete cascade,
  invoice_id uuid references public.invoices (id) on delete cascade,

  sent_at    timestamptz not null default now(),

  -- Exactly one target, and the right one for the kind. A quote follow-up
  -- pointing at an invoice is a bug that would otherwise surface as a
  -- reminder that can never be deduplicated.
  constraint followup_target check (
    (kind = 'quote_followup' and quote_id is not null and invoice_id is null)
    or
    (kind in ('invoice_reminder_1','invoice_reminder_2') and invoice_id is not null and quote_id is null)
  )
);

-- The idempotency guarantee: each kind is sendable AT MOST ONCE per document.
-- Partial indexes because a plain UNIQUE (kind, quote_id) treats NULLs as
-- distinct, which would leave the invoice rows (quote_id null) unconstrained.
create unique index if not exists followup_once_per_quote
  on public.followup_log (kind, quote_id) where quote_id is not null;
create unique index if not exists followup_once_per_invoice
  on public.followup_log (kind, invoice_id) where invoice_id is not null;

-- Plain FK-side indexes so the CASCADE deletes above stay cheap: the partial
-- unique indexes lead on kind and cannot serve a lookup by document id alone.
create index if not exists followup_log_quote_idx   on public.followup_log (quote_id);
create index if not exists followup_log_invoice_idx on public.followup_log (invoice_id);

alter table public.followup_log enable row level security;

-- service_role bypasses RLS but NOT table grants — same lesson as 0006.
grant all on public.followup_log to service_role;
