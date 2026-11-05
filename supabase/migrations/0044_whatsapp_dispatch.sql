-- WhatsApp going OUT: telling the crew a job is booked, and knowing it landed.
--
-- 0010 built the inbound half — a sub sends a photo, it is filed against a job.
-- Nothing has ever gone the other way. This is the doorbell: one utility
-- template per crew member per dispatch, carrying the job number, the arrival
-- window, the street and a button to the crew page that 0020 already built.
--
-- WHY THE MESSAGE CARRIES ALMOST NOTHING
--
-- Every distinct sentence we might send is a separate Meta template and a
-- separate review. Put the tasks in the message and every new shape of job is a
-- new submission; put them on the crew page and two templates cover the
-- business forever. It also keeps pricing out BY CONSTRUCTION rather than by
-- discipline: a template whose only variables are a job number, a time, a
-- street and a token has no field a price could travel in.
--
-- WHAT THIS MIGRATION IS FOR
--
-- Sending is one API call; knowing what happened to it is the part that needs
-- storage. A dispatch row is written BEFORE the call, so a crash between "Meta
-- accepted it" and "we wrote it down" leaves a record that a send was attempted
-- rather than no record at all. The wamid is patched in afterwards, and the
-- status webhook — which already arrives, on the same subscription as inbound —
-- walks the row from sent to delivered, read, or failed.

-- ---------------------------------------------------------------------------
-- What we learn about a message after it leaves
-- ---------------------------------------------------------------------------

alter table public.whatsapp_messages
  add column if not exists template_name    text,
  -- Meta's own error code and its human half. Kept because the codes are how
  -- you tell "this number is not on WhatsApp" (131026, fall back to SMS) from
  -- "your template was paused" (132000-series, nothing will send until it is
  -- fixed) — two failures that look identical in a log line.
  add column if not exists error_code       integer,
  add column if not exists error_detail     text,
  -- What Meta actually billed it as. A utility template silently recategorised
  -- as marketing costs more and is subject to different rules, and the pricing
  -- object on the status webhook is the only place that recategorisation shows.
  add column if not exists billing_category text;

-- ---------------------------------------------------------------------------
-- Dispatches — one row per person told about one job
-- ---------------------------------------------------------------------------
--
-- Separate from whatsapp_messages on purpose. A message is an envelope; a
-- dispatch is the intent behind it, and the intent survives the envelope
-- failing. When WhatsApp refuses, the fallback SMS is the same dispatch with a
-- different channel — not a second thing that happened.

create table if not exists public.job_dispatches (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  job_id     uuid not null references public.jobs (id) on delete cascade,
  contact_id uuid references public.whatsapp_contacts (id) on delete set null,

  -- The two things worth interrupting somebody's day for. Deliberately not a
  -- free-text field: each kind maps to one approved template, and a kind with
  -- no template is a message that cannot be sent.
  kind text not null check (kind in ('scheduled','schedule_changed')),

  channel text not null default 'whatsapp' check (channel in ('whatsapp','sms')),

  -- Meta's message id, patched in once the API answers. Null means the call
  -- never returned — either it failed, or we died mid-flight.
  wa_message_id text,

  sent_at      timestamptz not null default now(),
  delivered_at timestamptz,
  read_at      timestamptz,
  failed_at    timestamptz,
  error_code   integer,
  error_detail text
);

create index if not exists job_dispatches_job_idx
  on public.job_dispatches (job_id, sent_at desc);
create index if not exists job_dispatches_wamid_idx
  on public.job_dispatches (wa_message_id);

-- One dispatch of one kind, to one person, per job, per second. The unique key
-- includes sent_at so a genuine re-send tomorrow is allowed while a double-click
-- now is not — a second press inside the same second is the same intent, and
-- buzzing three phones twice is exactly the failure this feature would be
-- blamed for.
create unique index if not exists job_dispatches_once_idx
  on public.job_dispatches (job_id, contact_id, kind, sent_at);

alter table public.job_dispatches enable row level security;
grant all on public.job_dispatches to service_role;

-- ---------------------------------------------------------------------------
-- Did a human actually read it
-- ---------------------------------------------------------------------------
--
-- Delivered and read are platform receipts: they say a handset received bytes
-- and a screen displayed them. A tap on "C'est reçu" on the crew page is the
-- only signal that a person read the dispatch and understood it as work.
--
-- It lives on the token row because that is what the link opens. The token is
-- keyed on the job, so like last_viewed_at it can say SOMEONE acknowledged,
-- never WHO — with three crew that distinction is worth having, and the change
-- is (job_id, contact_id) as the key with one token minted per person. It is
-- deliberately not made here: it is a decision about links already in the wild,
-- and it is cheaper to take before dispatch ships than after.
alter table public.job_crew_tokens
  add column if not exists acknowledged_at timestamptz;

notify pgrst, 'reload schema';
