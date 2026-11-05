-- Renovision AnA — the ceiling becomes a surface an area can sit on.
--
-- `affected_areas` has modelled two surfaces since 0025: the floor and one
-- named wall. The ceiling was never one of them, and in this trade that is
-- the single most common loss there is — water arrives from the unit above,
-- and the first thing it damages is the ceiling of the unit below. Until now
-- that damage could be photographed and written in a note, but not measured,
-- which means it could not be priced: the estimator derives quantities from
-- areas, so a surface with no area on it produces no line.
--
-- The alternative was recording it as a floor area, and that is worse than
-- not recording it. A floor area fires the floor rules — protection, covering
-- removal, covering replacement, baseboard — so a wet ceiling would have
-- billed as a wet floor, at the wrong trade and the wrong rate, in a document
-- that goes to an insurer.
--
-- COORDINATES. A ceiling area's polygon is plan metres, exactly the floor's
-- space, because the ceiling is the floor's plane seen from underneath. It
-- draws on the plan with no transform, like a floor area, and carries no
-- wall_index. It must never be ADDED to the floor: the two coincide in plan,
-- so the sum double-counts, and they are different trades at different rates.
--
-- Nothing is rewritten. Existing rows keep the surface they have, the column
-- default stays 'floor', and both checks only widen — every row that was
-- legal before this migration is legal after it.

alter table public.affected_areas
  drop constraint if exists affected_areas_surface_check;

alter table public.affected_areas
  add constraint affected_areas_surface_check
  check (surface in ('floor','wall','ceiling'));

-- A wall area must say which wall; a floor or ceiling area must not pretend
-- to be one edge of anything.
alter table public.affected_areas
  drop constraint if exists affected_area_wall_index;

alter table public.affected_areas
  add constraint affected_area_wall_index check (
    (surface = 'wall' and wall_index is not null)
    or (surface in ('floor','ceiling') and wall_index is null)
  );
