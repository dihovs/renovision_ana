-- Things the owner dictates to Ana on the phone.
--
-- The owner is on a roof or in a van for most of the working day, which is
-- exactly when he remembers that someone needs calling back. Until now the only
-- place to put that thought was his own memory: the CRM's to-do list is derived
-- (unread leads, overdue invoices) and has nowhere to write "order the
-- membrane for Thursday". This table is that nowhere.
--
-- Deliberately the ONLY write owner mode can perform. Everything else the voice
-- agent can reach when the owner authenticates is read-only, and that boundary
-- is the real security control behind a spoken PIN (see src/lib/voice/owner.ts).
-- A note appended to a list is the most it can cost if that PIN is ever
-- overheard — nothing here moves money, touches a customer record, or sends
-- anything to anyone.
--
-- Free text rather than a structured task object. What arrives is one spoken
-- sentence transcribed by ASR; parsing it into assignees and priorities would
-- invent structure that was never said. The owner reads it back later and knows
-- what he meant.

create table if not exists public.owner_tasks (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- What was said, redacted of the owner PIN before it ever gets here.
  body text not null check (length(btrim(body)) > 0),

  -- A date, not a timestamp: "Thursday" is the resolution a person dictates in.
  -- Nullable because most of these are just "don't forget", with no deadline.
  due_date date,

  -- Null until it is ticked off. A timestamp rather than a boolean so the list
  -- can answer "what did I actually get done last week", which a boolean cannot.
  done_at timestamptz,

  -- Which channel it came in through, matching the `source` idiom on leads
  -- (0011). Text, not an enum, for the same reason: a new channel should be a
  -- value, not a migration.
  source text not null default 'voice',

  -- The call it was dictated on, so a task can be traced back to the
  -- conversation. Plain text, not a foreign key: calls are purged on the 24
  -- month retention schedule (0009) and a task must outlive its transcript.
  call_sid text
);

-- The only two reads this table has: the open list, newest first, and anything
-- due soon.
create index if not exists owner_tasks_open_idx on public.owner_tasks (created_at desc)
  where done_at is null;
create index if not exists owner_tasks_due_idx  on public.owner_tasks (due_date)
  where done_at is null;

alter table public.owner_tasks enable row level security;

grant all on public.owner_tasks to service_role;

drop trigger if exists owner_tasks_touch_updated_at on public.owner_tasks;
create trigger owner_tasks_touch_updated_at
  before update on public.owner_tasks
  for each row execute function public.touch_updated_at();
