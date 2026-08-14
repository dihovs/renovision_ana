-- Renovision AnA — living area, the measurement that decides money.
--
-- Coverage limits, replacement cost and appraised value are all quoted per
-- square foot of LIVING area, which is a far narrower thing than floor area:
-- a basement can be finished, heated and carpeted and still count zero
-- toward it. Until now this app could not express that difference at all,
-- which meant its floor-area figures could be read as living area by anyone
-- who did not know better — including an adjuster reading the report.
--
-- The rules follow ANSI Z765, the standard appraisers and carriers cite.

alter table public.room_scans
  -- Bedroom, basement, garage… decides the default percentage AND which
  -- band the room counts toward. Text rather than an enum: the list will
  -- grow, and a constraint that refuses a new room type is a constraint
  -- somebody works around by mislabelling a room.
  add column if not exists room_type text,

  -- A hand-set override, 0-100. NULL means "use the type's default", which
  -- is different from 0 — one is unanswered, the other is a decision that
  -- this space does not count.
  add column if not exists living_percent numeric
    check (living_percent is null or (living_percent >= 0 and living_percent <= 100));

alter table public.projects
  -- { includeInteriorWalls, minHeightM }. Per project because a commercial
  -- appraisal and a residential claim can genuinely want different rules,
  -- and because the threshold is a citable standard the operator may need to
  -- state rather than assume.
  add column if not exists living_area_config jsonb;
