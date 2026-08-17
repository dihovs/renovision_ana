-- Renovision AnA — who a project belongs to, and which ones are starred.
--
-- Both columns exist to back the project card's overflow menu on the phone
-- (magicplan's Favorite · Move · Duplicate · Archive), reduced to what this
-- business actually has.
--
-- WHY assigned_to IS FREE TEXT AND NOT A FOREIGN KEY
--
-- There is deliberately no staff table here. 0012 settled that when it stored
-- a timesheet's worker the same way: "Free text, no staff table. The crew is
-- a handful of names the owner knows; an employees module would be more
-- system than the business." Nothing has changed — the crew is still a
-- handful of names, and crew ACCESS is already solved per-job by the
-- revocable links in 0020 rather than by accounts anybody has to administer.
--
-- So this is the same shape as `time_entries.person`: a name, typed once and
-- offered back as a suggestion afterwards. The suggestion list is a DISTINCT
-- over this column, which means it needs no second table to maintain and
-- cannot drift out of step with what has actually been assigned.
--
-- Nullable because unassigned is the normal state of a job nobody has been
-- sent to yet, and is meaningfully different from an empty name.
alter table public.projects
  add column if not exists assigned_to text;

-- Starred jobs, for the reference's Favorite. Deliberately NOT the
-- "make available offline" half of what magicplan's star does — this app has
-- no download-pinning to promise, and a star that claimed offline access it
-- could not deliver would be a lie told in one tap.
alter table public.projects
  add column if not exists is_favorite boolean not null default false;

-- The list orders by updated_at and filters on status; favourites are read
-- alongside that rather than scanned for, so a partial index on the true
-- rows is the whole of what this needs.
create index if not exists projects_favorite_idx
  on public.projects (is_favorite)
  where is_favorite;

notify pgrst, 'reload schema';
