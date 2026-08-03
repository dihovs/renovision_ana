-- Express consent, an internal do-not-call list, and one new call kind.
--
-- WHY THIS EXISTS
--
-- 0018 deliberately allowed three call kinds, all of them pure logistics: the
-- visit is tomorrow, the crew is on the way, the time moved. Its header says a
-- "follow up on the quote" kind is not a small change, and it was right. An
-- introductory call to a potential partner is a bigger one still, because it is
-- unambiguously solicitation.
--
-- Under the CRTC's Unsolicited Telecommunications Rules, an AI voice placing a
-- call is an ADAD. Part IV rule 2 forbids a telemarketing call via an ADAD
-- unless express consent has been given, and Telecom Regulatory Policy
-- 2014-155 ¶51–53 refuses to carve out calls that are only partly promotional:
-- the Commission would not try to find the point at which solicitation becomes
-- the primary purpose, and expects businesses to go and ask for consent
-- instead. An existing relationship does not substitute for it.
--
-- Business-to-business does not rescue this either. B2B calls are exempt from
-- Part II (the National DNCL Rules), and from nothing else: the CRTC's own
-- guidance for businesses states that calls to business numbers "are only
-- regulated under Part III and Part IV of the UTRs, namely the Telemarketing
-- Rules and the ADAD Rules." Part IV is the one that requires consent. So a
-- call introducing the company to a contractor or a property manager needs
-- express consent from that number, exactly as a call to a household would.
--
-- Hence: consent is a row, not a checkbox in someone's memory, and no intro
-- call can be queued or dialled without one that is live at that moment.

-- ---------------------------------------------------------------------------
-- 1. Express consent to be called by an automated voice.
-- ---------------------------------------------------------------------------
--
-- Part IV rule 3 requires the record to evidence the authorisation and to be
-- tied to the SPECIFIC telephone number. Records must be producible to the
-- Commission within 30 days of a request, and the onus is on us to show the
-- consent was valid — which is why this table stores the wording that was
-- actually used rather than a reference to whatever the form says today.

create table if not exists public.outbound_consents (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- The number consented to, E.164. The rule is per-number, not per-person: a
  -- contact who gave consent on their mobile has not consented on the office
  -- line, and merging the two would be exactly the assumption the rule exists
  -- to prevent.
  phone text not null check (phone ~ '^\+[1-9][0-9]{7,14}$'),

  -- Who it is, for the record and for the call. Free text: a partner is often
  -- not a client row, and inventing one to hold a phone number would put
  -- non-customers into the customer table.
  contact_name text,
  company_name text,

  -- Optional link when the contact IS in the CRM. Set null rather than deleted
  -- if the client goes: the consent record has its own retention obligation and
  -- must outlive the relationship.
  client_id uuid references public.clients(id) on delete set null,

  -- HOW it was obtained. The UTRs accept written, oral (recorded or verified by
  -- a third party), electronic, or any other method with a documented record.
  -- Constrained so the value stays auditable.
  channel text not null check (channel in ('in_person', 'email', 'web_form', 'phone_recorded', 'written')),

  -- The exact words the person agreed to, captured verbatim at the time. Not a
  -- version number pointing at a template: templates get edited, and then the
  -- record no longer evidences what was actually agreed.
  wording text not null check (length(btrim(wording)) > 0),

  -- What the wording covered. Today only automated introductory calls; a second
  -- purpose should be a second row with its own wording, never a widening of
  -- this one.
  purpose text not null default 'business_intro' check (purpose in ('business_intro')),

  -- Where the evidence lives — a link to the signed form, the email thread, the
  -- recording. Nullable because in_person consent may be attested rather than
  -- filed, and an empty field is more honest than a fabricated reference.
  evidence_url text,
  evidence_note text,

  -- Who in the office recorded it. Not an auth user id: there is one admin
  -- password, so this is a typed name and is treated as an attestation.
  recorded_by text,

  -- Consent is open-ended unless someone sets a date. The UTRs put no expiry on
  -- express consent, so an automatic one would be invention — but a partner who
  -- said "sure, for this year" should be recordable as saying that.
  expires_at timestamptz,

  -- Withdrawal. Consent can be withdrawn at any time, and withdrawal is
  -- recorded rather than by deleting the row: the fact that consent once
  -- existed is part of the record we may have to produce.
  withdrawn_at timestamptz,
  withdrawn_note text
);

-- The one read on the hot path: is there a live consent for this number?
create index if not exists outbound_consents_live_idx
  on public.outbound_consents (phone)
  where withdrawn_at is null;

create index if not exists outbound_consents_client_idx
  on public.outbound_consents (client_id)
  where client_id is not null;

alter table public.outbound_consents enable row level security;
grant all on public.outbound_consents to service_role;

drop trigger if exists outbound_consents_touch_updated_at on public.outbound_consents;
create trigger outbound_consents_touch_updated_at
  before update on public.outbound_consents
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Internal do-not-call list, keyed by number.
-- ---------------------------------------------------------------------------
--
-- `clients.do_not_call` (0018) covers customers and only customers. Every
-- obligation that survives a DNCL exemption applies here too: maintain an
-- internal list, add a number within 14 days of the request, and keep the entry
-- for three years and fourteen days. A partner who asks not to be called again
-- is usually not a client row at all, so the boolean on `clients` has nowhere
-- to put them — which is a gap, not a design.
--
-- Number-keyed and unique, so "have they asked us to stop" is one lookup with
-- no joins and no chance of two half-answers.

create table if not exists public.do_not_call_list (
  phone      text primary key check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  created_at timestamptz not null default now(),

  -- When they asked. Distinct from created_at, which is when we got round to
  -- typing it in: the 14-day window and the 3-year retention both run from the
  -- request, not from the data entry.
  requested_at timestamptz not null default now(),

  -- 'call' when they said it to Ana mid-call, which is the common one.
  source text not null default 'call',
  note   text
);

create index if not exists do_not_call_list_requested_idx
  on public.do_not_call_list (requested_at);

alter table public.do_not_call_list enable row level security;
grant all on public.do_not_call_list to service_role;

-- ---------------------------------------------------------------------------
-- 3. The new call kind.
-- ---------------------------------------------------------------------------
--
-- Widening a CHECK constraint, not dropping it. The constraint is what makes an
-- unknown kind fail loudly instead of selecting no script and calling someone
-- with silence, and that property is worth keeping.

alter table public.call_tasks drop constraint if exists call_tasks_kind_check;
alter table public.call_tasks add constraint call_tasks_kind_check
  check (kind in ('confirm_visit', 'crew_on_way', 'schedule_change', 'business_intro'));

-- One introduction per number, ever. Not per week, not per campaign: a second
-- automated "hello, let me introduce the company" to someone who already got
-- one is the behaviour that makes people hang up on the first one. A real
-- follow-up after an introduction is a call Artush makes himself.
create unique index if not exists call_tasks_one_intro_per_number
  on public.call_tasks (phone)
  where kind = 'business_intro' and status <> 'cancelled';
