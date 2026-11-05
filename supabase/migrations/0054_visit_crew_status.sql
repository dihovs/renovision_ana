-- Who is on a visit, and where it stands. (Field-service spine, step 7)
--
-- A visit was a time and a completion date. Two things were missing:
--
--   * the crew. A job had a WhatsApp dispatch to whoever was ticked that day,
--     but nothing said "Jean-Marc and Rémi are on Tuesday's visit". That is
--     what a schedule per person, a timesheet per visit and a crew page that
--     knows who opened it all need.
--
--   * a status. "Booked", "the crew has been told", "done" are three
--     different states and the office needs to see which visits are still in
--     the first one.
--
-- STATUS IS KEPT IN STEP WITH completed_at BY A TRIGGER
--
-- Every existing write path (the job page, the crew page, the phone's
-- Schedule, recurrence generation) sets or clears `completed_at` and knows
-- nothing about `status`. Rather than touch all of them and miss one, the
-- database derives the done/not-done half: setting completed_at makes the
-- visit completed; clearing it puts it back to scheduled (or dispatched, if
-- the crew had already been told). `dispatched` is set by the dispatch code
-- when a message actually goes out.

alter table public.visits
  add column if not exists status text not null default 'scheduled'
    check (status in ('unscheduled','scheduled','dispatched','completed')),
  add column if not exists dispatched_at timestamptz;

update public.visits set status = 'completed' where completed_at is not null and status <> 'completed';

create or replace function public.visits_sync_status()
returns trigger
language plpgsql
as $$
begin
  if new.completed_at is not null then
    new.status := 'completed';
  elsif new.status = 'completed' then
    new.status := case when new.dispatched_at is not null then 'dispatched' else 'scheduled' end;
  end if;
  return new;
end $$;

drop trigger if exists visits_sync_status on public.visits;
create trigger visits_sync_status
  before insert or update of completed_at, status on public.visits
  for each row execute function public.visits_sync_status();

create index if not exists visits_status_idx on public.visits (status, starts_at);

-- ---------------------------------------------------------------------------
-- The crew on a visit
-- ---------------------------------------------------------------------------

create table if not exists public.visit_assignees (
  visit_id       uuid not null references public.visits (id) on delete cascade,
  team_member_id uuid not null references public.team_members (id) on delete cascade,
  created_at     timestamptz not null default now(),
  primary key (visit_id, team_member_id)
);

-- "My schedule": every visit one person is on.
create index if not exists visit_assignees_member_idx on public.visit_assignees (team_member_id);

alter table public.visit_assignees enable row level security;
grant all on public.visit_assignees to service_role;

notify pgrst, 'reload schema';
