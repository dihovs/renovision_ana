-- Renovision AnA — making the conversion chain impossible to run twice.
--
--   lead → client → job → visit → invoice
--
-- Every hop is a button. Buttons get double-tapped, especially on a phone on a
-- job site with two bars of signal, and every one of these hops copies money.
-- Two jobs from one quote is the same work counted twice in every report; two
-- invoices for one job is a customer asked for the same money twice.
--
-- The application already checks before each hop, but a read-then-insert has a
-- window: two taps a few hundred milliseconds apart both read "not converted
-- yet" and both insert. Nothing in application code can close that window. A
-- unique index can, and it keeps holding when a future code path forgets to
-- check at all — which is the failure this is really insuring against.
--
-- These are PARTIAL unique indexes rather than constraints because every one of
-- them is conditional: only rows that actually came from a conversion, only
-- invoices that are still on the books.
--
-- BEFORE RUNNING: these will fail if the data already contains a duplicate.
-- That is the point — a failure here means a double conversion already
-- happened and needs a human decision about which row survives. The three
-- queries to find them are at the bottom of this file.

-- ---------------------------------------------------------------------------
-- One client per lead
-- ---------------------------------------------------------------------------
--
-- The link already exists as `leads.client_id` (migration 0004). This is the
-- same fact recorded from the other side, and it is not redundant: converting
-- a lead is two writes with no transaction around them — insert the client,
-- then point the lead at it. When the second write fails, the old code left a
-- client that nothing referenced, and the next press of the button made
-- another one. With the link on the client row it is written by the SAME
-- INSERT that creates the client, so it cannot be the half that fails.
--
-- `on delete set null` rather than cascade: purging a lead must never destroy
-- the customer record, which by then has quotes and invoices hanging off it.

alter table public.clients
  add column if not exists lead_id uuid references public.leads (id) on delete set null;

comment on column public.clients.lead_id is
  'The lead this client was converted from, written at insert time. Unique — a lead becomes at most one client.';

create unique index if not exists clients_one_per_lead
  on public.clients (lead_id)
  where lead_id is not null;

-- ---------------------------------------------------------------------------
-- One job per quote, ever
-- ---------------------------------------------------------------------------
--
-- Deliberately NOT filtered on `archived_at`. A quote that was converted and
-- then had its job archived has still been converted; allowing a second job
-- would double the value of that quote in every report while the evidence sits
-- hidden from the job list. The application refuses that case with a message
-- telling the owner to restore the archived job instead.

create unique index if not exists jobs_one_per_quote
  on public.jobs (quote_id)
  where quote_id is not null;

-- ---------------------------------------------------------------------------
-- One deposit and one final invoice per job
-- ---------------------------------------------------------------------------
--
-- A job is billed at most twice: a deposit up front, and the balance on
-- completion. Two separate indexes rather than one, because they are two
-- different documents that may legitimately coexist — the balance invoice
-- credits the deposit back at its tax-inclusive total, so the two add up to
-- exactly the job.
--
-- Filtered on `archived_at` here, unlike jobs above: an invoice archived by
-- mistake has to be re-issuable, and unlike a job it carries its own frozen
-- copy of everything, so a replacement is a genuinely new document rather than
-- a duplicate of a live one.

create unique index if not exists invoices_one_final_per_job
  on public.invoices (job_id)
  where job_id is not null and is_deposit = false and archived_at is null;

create unique index if not exists invoices_one_deposit_per_job
  on public.invoices (job_id)
  where job_id is not null and is_deposit = true and archived_at is null;

-- ---------------------------------------------------------------------------
-- If any of the above fails: finding what is already duplicated
-- ---------------------------------------------------------------------------
--
--   select quote_id, count(*), array_agg(job_number)
--     from public.jobs
--    where quote_id is not null
--    group by quote_id having count(*) > 1;
--
--   select job_id, is_deposit, count(*), array_agg(invoice_number)
--     from public.invoices
--    where job_id is not null and archived_at is null
--    group by job_id, is_deposit having count(*) > 1;
--
--   select lead_id, count(*) from public.clients
--    where lead_id is not null group by lead_id having count(*) > 1;
--
-- Archive the duplicate, or null out its `quote_id` / `job_id` if it is real
-- work that simply lost its link, then run this file again.
