-- Outbound notification calls: the queue, and what came of them.
--
-- Ana already answers the phone. This is her placing it — but only ever to
-- tell someone something about an appointment they already booked with us:
-- the crew is on the way, the time has moved, tomorrow at nine still good.
--
-- That narrowness is a legal boundary, not a product decision. Under the
-- CRTC's rules a synthesized voice placing calls is an ADAD, and ADAD rules
-- apply even when nothing is being sold. Non-solicitation calls are allowed
-- without prior consent; the moment a call solicits — even indirectly, even
-- to an existing customer — it becomes ADAD telemarketing and needs express
-- consent that an existing relationship does not supply. So there is no
-- "follow up on the quote" kind here, and adding one is not a small change.
-- See Docs/Voice-Outbound-Compliance.md.
--
-- The destination number is denormalized onto the row at queue time rather
-- than joined at dial time. Two reasons: the number that was verified against
-- the CRM when the task was created is the number that gets dialled, so a
-- later edit to the client record cannot silently redirect a queued call; and
-- the dialer never has to resolve a contact, which keeps "who do we call"
-- entirely out of the hot path.

create table if not exists public.call_tasks (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Why we are calling. Constrained rather than free text because each kind
  -- selects a different opening script, and an unknown kind must fail loudly
  -- at insert instead of producing a call with no idea what to say.
  kind text not null check (kind in ('confirm_visit', 'crew_on_way', 'schedule_change')),

  -- What this is about. visit_id is the usual anchor; it is nullable so a
  -- one-off dictated notice about a job with no booked visit still works.
  visit_id  uuid references public.visits (id)  on delete cascade,
  job_id    uuid references public.jobs (id)    on delete cascade,
  client_id uuid references public.clients (id) on delete cascade,

  -- E.164, resolved and frozen when the task was queued.
  to_number text not null check (to_number ~ '^\+[1-9][0-9]{7,14}$'),
  locale    text not null default 'fr' check (locale in ('fr', 'en')),

  -- Kind-specific detail the script needs: the appointment time being
  -- confirmed, the new time, the ETA. Shape belongs to the code, not here.
  payload jsonb not null default '{}'::jsonb,

  -- queued      — waiting for the dialer
  -- dialing     — handed to ElevenLabs, no result yet
  -- done        — a call happened; read `outcome` for what came of it
  -- failed      — could not be placed, and retries are exhausted
  -- cancelled   — the visit moved or was deleted before we called
  status text not null default 'queued'
    check (status in ('queued', 'dialing', 'done', 'failed', 'cancelled')),

  -- The earliest this may be dialled. Carries both the business meaning
  -- ("twenty-four hours before the visit") and the legal one: calling hours
  -- are restricted, so a task that comes due at 03:00 is pushed here rather
  -- than dialled. The dialer only ever looks for queued rows whose
  -- not_before has passed.
  not_before timestamptz not null default now(),

  attempts        smallint not null default 0,
  max_attempts    smallint not null default 3,
  last_attempt_at timestamptz,

  -- Correlation. call_sid is minted by us BEFORE dialling and passed to
  -- ElevenLabs, so the post-call webhook can find this row even if the
  -- provider's own identifiers never make it back.
  call_sid        text unique,
  conversation_id text,

  -- Set when the call ends. See Docs/Voice-Outbound-Conversation.md for what
  -- each value means and which one wins when several could apply.
  outcome text check (outcome in (
    'reached_confirmed',
    'reached_declined',
    'reached_reschedule_requested',
    'reached_unresolved',
    'reached_third_party',
    'voicemail_left',
    'voicemail_no_message',
    'no_answer',
    'wrong_number',
    'opt_out_requested',
    'failed'
  )),

  -- Anything worth reading that isn't the outcome code: the customer's own
  -- words when they asked to move the date (stored verbatim and never parsed
  -- into a timestamp — "jeudi prochain avant-midi" off a phone line is how a
  -- crew ends up at the wrong house), a callback window, a note.
  outcome_detail jsonb not null default '{}'::jsonb,
  completed_at   timestamptz,

  -- Free text for a failure that never became a conversation.
  error text
);

-- The dialer's only query: what is due right now.
create index if not exists call_tasks_due_idx
  on public.call_tasks (not_before)
  where status = 'queued';

create index if not exists call_tasks_visit_idx  on public.call_tasks (visit_id);
create index if not exists call_tasks_client_idx on public.call_tasks (client_id);
create index if not exists call_tasks_created_idx on public.call_tasks (created_at desc);

-- One confirmation per visit, ever. The 24-hour sweep runs daily and would
-- otherwise re-queue the same reminder every run; this makes the scheduler
-- idempotent in the database instead of relying on it to remember.
create unique index if not exists call_tasks_one_confirm_per_visit
  on public.call_tasks (visit_id, kind)
  where kind = 'confirm_visit' and visit_id is not null;

drop trigger if exists call_tasks_touch on public.call_tasks;
create trigger call_tasks_touch
  before update on public.call_tasks
  for each row execute function public.touch_updated_at();

alter table public.call_tasks enable row level security;
grant all on public.call_tasks to service_role;

-- Never call this person again.
--
-- Lives on the client, not on call_tasks, because an opt-out is about the
-- person and has to outlive whichever call it was said on. Deliberately a
-- plain boolean rather than something derived from a call's outcome code:
-- suppression must not depend on a classifier having picked the right value
-- out of eleven. Ana sets this live, mid-call, at the moment she tells the
-- customer she is removing them — which means it is true by the time she has
-- finished the sentence.
alter table public.clients
  add column if not exists do_not_call boolean not null default false;

comment on column public.clients.do_not_call is
  'Customer asked not to be called by the automated assistant. Checked before every outbound dial; never cleared automatically.';
