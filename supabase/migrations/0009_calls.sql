-- Call transcripts.
--
-- Text only, never audio. A recording of a distressed customer describing water
-- coming through their ceiling is a far heavier thing to hold than a transcript
-- of the same call: it carries their voice, it is unambiguously biometric-
-- adjacent, and it is worth more to an attacker. The transcript answers every
-- operational question we actually have — what did they say, what did we say,
-- did the agent get it right — so the audio is never written down.
--
-- Stored on our own Postgres rather than the telephony vendor's cloud. The
-- point of the whole architecture is that the record of a customer conversation
-- belongs to the business, not to whoever happened to carry the packets.

create table if not exists public.calls (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Twilio's identifier for the call. Unique so a retried webhook updates the
  -- existing row instead of creating a second record of one conversation.
  call_sid   text unique,

  -- E.164. The caller's number is personal information: it is the single most
  -- useful field for calling them back and also the one that most needs the
  -- retention policy below.
  from_number text,
  to_number   text,

  -- in_progress — the call is live
  -- completed   — ended normally
  -- failed      — the pipeline broke mid-call; worth seeing in a list
  -- abandoned   — caller hung up before saying anything useful
  status text not null default 'in_progress'
         check (status in ('in_progress','completed','failed','abandoned')),

  started_at timestamptz not null default now(),
  ended_at   timestamptz,
  duration_seconds integer,

  -- The language the agent settled into. The default site language is French,
  -- and a French caller met in English is worse than voicemail.
  locale text not null default 'fr' check (locale in ('fr','en')),

  -- The dialogue, both sides, in order:
  --   [{ role: 'caller'|'agent', text, at, model?, escalated? }]
  --
  -- jsonb rather than a turns table. A transcript is only ever read whole, in
  -- order, alongside its call — there is no query that wants turn 4 of call 87
  -- without the rest, and a child table would buy nothing for the join it costs.
  turns jsonb not null default '[]'::jsonb,

  -- Which model carried the conversation, and whether it had to escalate.
  -- Escalation is the signal that the cheap model was not landing, so it is the
  -- number worth watching as the prompt is tuned.
  model         text,
  escalated_at  timestamptz,
  escalation_reason text,

  -- What the agent managed to establish, same shape as the chat widget's brief
  -- so both feed the same lead pipeline.
  project_brief jsonb,

  -- The lead this call produced, if any. SET NULL rather than cascade: purging
  -- an aged-out lead must not destroy the record that the call happened.
  lead_id uuid references public.leads (id) on delete set null,

  -- Escalated to a human. Recorded because "the agent handed off" and "the
  -- agent finished the job" are different outcomes and only one needs review.
  transferred_at timestamptz,

  notes text
);

create index if not exists calls_started_idx on public.calls (started_at desc);
create index if not exists calls_status_idx  on public.calls (status);
create index if not exists calls_lead_idx    on public.calls (lead_id);
create index if not exists calls_from_idx    on public.calls (from_number);

alter table public.calls enable row level security;

grant all on public.calls to service_role;

drop trigger if exists calls_touch_updated_at on public.calls;
create trigger calls_touch_updated_at
  before update on public.calls
  for each row execute function public.touch_updated_at();

-- Retention.
--
-- Matches the published policy for leads: enquiries that never became work are
-- deleted after 24 months. A transcript attached to a lead that became a job is
-- kept, because it is part of the record of what was agreed.
--
-- Not scheduled here. Enable pg_cron and schedule it, or run it by hand — an
-- unscheduled policy nobody executes is the same as no policy at all.
create or replace function public.purge_stale_calls()
returns integer
language plpgsql
as $$
declare
  removed integer;
begin
  delete from public.calls c
   where c.started_at < now() - interval '24 months'
     and (
       c.lead_id is null
       or exists (
         select 1 from public.leads l
          where l.id = c.lead_id
            and l.status in ('new','contacted','quoted','lost')
       )
     );
  get diagnostics removed = row_count;
  return removed;
end;
$$;
