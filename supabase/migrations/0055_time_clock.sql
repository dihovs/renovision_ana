-- Clock in / clock out, per visit, per person, with approval.
-- (Field-service spine, step 8)
--
-- 0012 deliberately made time a typed-in total ("one row per person per day
-- per job — no clock"), because there was one owner and no staff table. With
-- a team (0053) and crew on visits (0054), the crew page can now run a timer:
-- Start when they arrive, Stop when they leave, and the office approves the
-- week.
--
-- SAME TABLE, NOT A NEW ONE
--
-- A clocked entry is a time entry with a start and an end. Keeping one table
-- means the Reports page's labour figures and the Expenses page's list count
-- clocked and typed hours together without a union. A typed entry simply has
-- no started_at.
--
-- A RUNNING TIMER HAS NO MINUTES YET
--
-- `minutes` becomes nullable for exactly one shape: started, not ended. The
-- check says so, and every reader that sums minutes skips the running row.
-- Stopping writes ended_at and minutes in one update.

alter table public.time_entries
  add column if not exists visit_id       uuid references public.visits (id) on delete set null,
  add column if not exists team_member_id uuid references public.team_members (id) on delete set null,
  add column if not exists started_at     timestamptz,
  add column if not exists ended_at       timestamptz,
  add column if not exists approved_at    timestamptz,
  add column if not exists source text not null default 'manual' check (source in ('manual','clock'));

alter table public.time_entries alter column minutes drop not null;
alter table public.time_entries drop constraint if exists time_entries_minutes_check;
alter table public.time_entries drop constraint if exists time_entries_minutes_shape;
alter table public.time_entries add constraint time_entries_minutes_shape check (
  (minutes is null and started_at is not null and ended_at is null)
  or (minutes is not null and minutes > 0)
);

-- One running clock per person. A second Start while one runs is refused by
-- the database, not just hidden by the page.
create unique index if not exists time_entries_one_open_clock
  on public.time_entries (team_member_id)
  where started_at is not null and ended_at is null;

create index if not exists time_entries_member_week_idx
  on public.time_entries (team_member_id, worked_on);
create index if not exists time_entries_visit_idx on public.time_entries (visit_id);

notify pgrst, 'reload schema';
