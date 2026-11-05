-- Tasks for the team: who, for which job, and whether it repeats.
-- (Field-service spine, step 10)
--
-- 0017's tasks were the owner's own dictated notes, free text by design. The
-- text stays free; what is added is the structure a SECOND person needs to
-- act on one: whose it is, which job it belongs to, and — for "check the
-- dehumidifier every Monday" — when it comes back.
--
-- A REPEAT IS A NEW ROW, MADE WHEN THE LAST ONE IS TICKED
--
-- Ticking a repeating task creates the next one, due one period later.
-- `repeated_from` points at the task that made it, which is what stops
-- tick → untick → tick from creating two: the next copy is made only if
-- none points back yet.

alter table public.owner_tasks
  add column if not exists assignee_id uuid references public.team_members (id) on delete set null,
  add column if not exists job_id uuid references public.jobs (id) on delete set null,
  add column if not exists repeat_rule text not null default 'none'
    check (repeat_rule in ('none','daily','weekly','monthly')),
  add column if not exists repeated_from uuid references public.owner_tasks (id) on delete set null;

create index if not exists owner_tasks_assignee_idx on public.owner_tasks (assignee_id) where done_at is null;
create index if not exists owner_tasks_job_idx on public.owner_tasks (job_id);
create unique index if not exists owner_tasks_repeat_once_idx
  on public.owner_tasks (repeated_from) where repeated_from is not null;

notify pgrst, 'reload schema';
