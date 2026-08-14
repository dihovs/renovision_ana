-- Renovision AnA — affected areas: the damaged region inside a scanned room.
--
-- This is the join between a measurement and an invoice. A room scan says the
-- basement floor is 420 sq ft; an affected area says 96 sq ft of it is wet,
-- and THAT is the number a flooring line gets priced from. Without it a scan
-- is a survey; with it a scan is an estimate.
--
-- Modelled on how a restoration estimator actually works:
--
--   * An area belongs to a SURFACE, not to a room in the abstract — the floor
--     or one specific wall. A wet floor and a mouldy wall are different scopes
--     with different trades and different rates, and they overlap in plan.
--     `surface` plus `wall_index` says which.
--   * Areas MAY overlap. Two categories of damage on the same square foot is a
--     real thing (a wall that is both wet and smoke-stained), so nothing here
--     enforces disjointness.
--   * `damage_type` is the coding, and it carries the IICRC vocabulary the
--     rest of the claim uses so an area can be filtered and priced by cause.

create table if not exists public.affected_areas (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- CASCADE: an area has no meaning without the room it was measured in.
  room_scan_id uuid not null references public.room_scans (id) on delete cascade,

  -- Which surface. A wall area also carries the index of the wall it sits on,
  -- as ordered in the scan's own geometry; a floor area leaves it null.
  surface    text not null default 'floor' check (surface in ('floor','wall')),
  wall_index integer,

  name text not null default 'Affected area',

  -- The cause, which is both the colour coding and the thing that decides
  -- which price-book lines apply. Deliberately the same vocabulary as the
  -- claim's Type of Loss.
  damage_type text not null default 'water'
    check (damage_type in ('water','fire','mould','impact','other')),

  -- Overridable colour. Null means "use the damage type's default", so
  -- recolouring a category later does not orphan old areas on stale colours.
  color text,

  -- SQUARE METRES, like every other measurement here. Computed from the
  -- polygon and stored so a report or an estimate can total areas without
  -- re-deriving geometry in SQL.
  area_sqm numeric not null default 0,

  -- The shape: [{x, y}, ...] in metres, in the plan's own normalised
  -- coordinate space (the same space toFloorPlan draws in), so it lines up
  -- with the walls without any further transform.
  polygon jsonb not null default '[]'::jsonb,

  notes text,

  -- A wall area must say which wall; a floor area must not pretend to.
  constraint affected_area_wall_index check (
    (surface = 'wall' and wall_index is not null)
    or (surface = 'floor' and wall_index is null)
  )
);

create index if not exists affected_areas_scan_idx
  on public.affected_areas (room_scan_id, surface);

alter table public.affected_areas enable row level security;
grant all on public.affected_areas to service_role;
