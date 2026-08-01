-- Renovision AnA — recurring visits and job checklists.
--
-- Two additions to the job screen. A recurrence is a pattern ("every two
-- weeks, Tuesday morning, until November") that the application expands into
-- ordinary rows in the visits table; a checklist is the list of steps the crew
-- must not forget on site.
--
-- The design decision that matters here: RECURRENCES GENERATE REAL VISITS,
-- THEY ARE NOT A VIRTUAL SERIES. The schedule, the job screen and every future
-- query keep reading the visits table exactly as they do today — a generated
-- visit is completed, moved or removed like any other. The pattern row exists
-- only so the generator knows what to (re)build, and so a visit can say which
-- pattern built it.

-- ---------------------------------------------------------------------------
-- Recurrences — the pattern behind generated visits
-- ---------------------------------------------------------------------------

create table if not exists public.job_recurrences (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- One pattern per job. A job that repeats on two different rhythms is two
  -- jobs; pretending otherwise buries the second rhythm in a UI nobody reads.
  job_id uuid not null unique references public.jobs (id) on delete cascade,

  frequency text not null check (frequency in ('weekly','biweekly','monthly')),

  -- The pattern is anchored on a concrete visit: same instant convention as
  -- visits themselves — stored UTC, stepped and rendered in America/Toronto
  -- wall-clock time. Stepping in wall-clock time is the point: "Tuesday 08:00"
  -- must still read 08:00 after the clocks change, which naive +7-day
  -- arithmetic on the instant would break twice a year.
  --
  -- Snapshotted from the anchor visit rather than referencing it, so deleting
  -- that visit later cannot orphan the pattern.
  anchor_starts_at timestamptz not null,
  anchor_ends_at   timestamptz,
  all_day          boolean not null default false,

  -- Copied onto every generated visit, so the schedule reads "Lawn + hedges"
  -- rather than twenty-six untitled rows.
  visit_title text,

  -- Last Toronto calendar day an occurrence may land on. Null means "as far
  -- as the generation cap allows" — the application caps the horizon either
  -- way, so an open-ended pattern cannot flood the calendar.
  until_date date
);

alter table public.job_recurrences enable row level security;

-- Which pattern generated a visit — null for one scheduled by hand. This is
-- what lets regeneration be idempotent: after an edit, only FUTURE visits that
-- carry this id and were never completed are wiped and rebuilt. Manual visits
-- and finished work are never touched.
--
-- SET NULL rather than cascade: when a pattern is stopped, the visits that
-- already happened stay on the record as ordinary history.
alter table public.visits
  add column if not exists recurrence_id uuid references public.job_recurrences (id) on delete set null;

create index if not exists visits_recurrence_idx on public.visits (recurrence_id);

-- ---------------------------------------------------------------------------
-- Checklists
-- ---------------------------------------------------------------------------
--
-- Flat items on the job, ordered by position. Deliberately not per-visit: the
-- crew's list ("photos before demolition", "lock the compressor cage") belongs
-- to the work, and splitting it across visits would mean re-ticking the same
-- boxes every trip.

create table if not exists public.job_checklist_items (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  job_id uuid not null references public.jobs (id) on delete cascade,

  label    text not null,
  done     boolean not null default false,
  -- Ordering is data, not created_at order — "turn off the water main" has to
  -- be movable above "open the wall" after somebody realises the hard way.
  position integer not null default 0
);

create index if not exists job_checklist_job_idx on public.job_checklist_items (job_id, position);

alter table public.job_checklist_items enable row level security;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

grant all on public.job_recurrences     to service_role;
grant all on public.job_checklist_items to service_role;

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------

drop trigger if exists job_recurrences_touch_updated_at on public.job_recurrences;
create trigger job_recurrences_touch_updated_at before update on public.job_recurrences
  for each row execute function public.touch_updated_at();

drop trigger if exists job_checklist_touch_updated_at on public.job_checklist_items;
create trigger job_checklist_touch_updated_at before update on public.job_checklist_items
  for each row execute function public.touch_updated_at();
