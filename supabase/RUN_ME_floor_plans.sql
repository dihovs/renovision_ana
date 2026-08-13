-- ============================================================================
-- Renovision AnA — floor plans, damage areas and claim fields, in one paste.
--
-- WHAT THIS IS
--   Migrations 0023 to 0027 concatenated, in order, so the whole thing can go
--   into the Supabase SQL editor once instead of five times. The individual
--   files in supabase/migrations/ are unchanged and remain the source of
--   truth; this is a convenience copy.
--
-- HOW TO RUN IT
--   1. Open your project at supabase.com, then SQL Editor in the left sidebar.
--   2. New query, paste ALL of this, press Run.
--   3. Expect "Success. No rows returned" — these create tables, not results.
--
-- IS IT SAFE TO RUN TWICE?
--   Yes. Every statement is `create table if not exists`, `add column if not
--   exists`, or `create index if not exists`. Running it again on a database
--   that already has these does nothing and destroys nothing.
--
--   The one `drop` in this file is `drop constraint if exists` on line ~57,
--   immediately followed by re-adding that same constraint — the standard way
--   to make a CHECK idempotent. It drops a rule, never a row. There is no
--   DELETE, no TRUNCATE, and no ALTER of an existing column's type anywhere.
--
-- WHAT IT TURNS ON
--   0023  estimates tied to a project, and Good/Better/Best tiers
--   0024  room_scans — floor plans have somewhere to live
--   0025  affected_areas — the damaged part of a room, and its square footage
--   0026  custom fields on a project — claim number, carrier, adjuster,
--         category and class of water
--   0027  where each room sits on its floor, once dragged into place
-- ============================================================================


-- ==========================================================================
-- 0023_quote_projects_and_tiers.sql
-- ==========================================================================

-- Quotes can belong to a project — the container an estimate is actually
-- built under, when the work is bigger than one quote. SET NULL rather than
-- CASCADE: archiving or deleting a project must not delete the financial
-- record of a quote that was built inside it — the quote just becomes
-- unaffiliated, same as a lead being deleted under a client (see 0001).
alter table public.quotes
  add column if not exists project_id uuid references public.projects (id) on delete set null;

create index if not exists quotes_project_idx
  on public.quotes (project_id) where project_id is not null;

-- Good/Better/Best: a line can belong to a named tier. Nullable and
-- additive on purpose — every existing quote has tier = null on every line,
-- so it keeps behaving exactly as it does today (a flat list of always-in
-- lines plus individually-tickable optional ones). Only a quote where the
-- operator deliberately assigns tiers gets the tier picker instead.
alter table public.quote_line_items
  add column if not exists tier text check (tier in ('good', 'better', 'best'));

-- A tiered line must also be optional: the tier choice IS how it gets
-- included, so "in a tier but never optional" is a contradiction the
-- database should refuse to store rather than silently allow.
alter table public.quote_line_items
  drop constraint if exists quote_line_tier_requires_optional;
alter table public.quote_line_items
  add constraint quote_line_tier_requires_optional check (tier is null or optional);

-- ==========================================================================
-- 0024_room_scans.sql
-- ==========================================================================

-- Renovision AnA — LiDAR room scans, kept against the project they measure.
--
-- A scan is a measurement of a real room at a real moment: 184 sq ft of
-- floor, 17 ft of baseboard, one staircase. Until now it lived in the phone's
-- memory and vanished on reload, which makes it useless for the thing it is
-- actually for — walking a property once and pricing the work afterwards.
--
-- Shaped after how a scanning app organises a job: a project holds floors,
-- a floor holds rooms. The floor is a plain text label rather than a table of
-- its own because it carries no data beyond its name and its order, and a
-- `floors` table would mean a join to answer "which storey is this room on".
--
-- The geometry is stored as jsonb, not exploded into columns. It is an opaque
-- measurement blob owned entirely by the scanner — walls, openings, their
-- transforms — and it is read back whole to redraw the plan. Splitting it
-- across relational columns would buy nothing: nothing queries a single wall.

create table if not exists public.room_scans (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- CASCADE: a scan has no meaning without the project it measured, the same
  -- reasoning as project_files. Deleting the folder deletes the survey in it.
  project_id uuid not null references public.projects (id) on delete cascade,

  -- "Kitchen", "Basement bathroom" — renamed freely on the phone.
  name  text not null,
  -- "Basement", "Ground", "2nd" — the storey, as typed on the scan screen.
  level text not null default 'Ground',
  -- Order within its floor, so rooms list in the sequence they were walked
  -- rather than by insertion time.
  position integer not null default 0,

  -- The measurements, in METRES and SQUARE METRES — the units RoomPlan
  -- reports. Every imperial figure in the UI is derived from these on the way
  -- out. Storing feet would bake one conversion into the record and lose the
  -- source measurement.
  floor_area_sqm    numeric not null default 0,
  wall_length_m     numeric not null default 0,
  ceiling_height_m  numeric not null default 0,

  door_count   integer not null default 0,
  window_count integer not null default 0,
  stair_count  integer not null default 0,

  -- The full RoomScanResult, for redrawing the plan. Opaque to SQL.
  geometry jsonb not null default '{}'::jsonb,

  notes text
);

create index if not exists room_scans_project_idx
  on public.room_scans (project_id, level, position);

alter table public.room_scans enable row level security;
grant all on public.room_scans to service_role;

-- ==========================================================================
-- 0025_affected_areas.sql
-- ==========================================================================

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

-- ==========================================================================
-- 0026_project_custom_fields.sql
-- ==========================================================================

-- Renovision AnA — custom fields on a project.
--
-- Clients, properties and quotes already carry a `custom` jsonb bag driven by
-- the definitions in app_settings.custom_fields. Projects did not, which is
-- the wrong way round for insurance work: the claim number, the carrier, the
-- adjuster and the category of water all describe the JOB, not the customer,
-- and a customer with two losses would otherwise overwrite their own claim.
--
-- Same shape as everywhere else — { fieldId: value } — so one renderer and
-- one settings screen serve every entity.

alter table public.projects
  add column if not exists custom jsonb not null default '{}'::jsonb;

-- ==========================================================================
-- 0027_room_positions.sql
-- ==========================================================================

-- Renovision AnA — where a room sits on its floor.
--
-- RoomPlan measures each room from wherever the operator was standing when
-- they started, so two rooms scanned separately carry no information about
-- how they fit together. Until now the floor plan drew them packed into tidy
-- rows and said so — honest, but not a floor plan.
--
-- These two numbers are the operator's answer to that: they drag each room
-- into place once, and the arrangement is a fact about the building that
-- belongs in the database rather than on one phone. Metres, like every other
-- measurement here, in the floor's own plan space.
--
-- NULL means "not placed yet" and is different from 0,0 — a room at the
-- origin has been deliberately put there, a NULL room still falls back to the
-- packed layout. Storing 0 by default would make every new room claim the
-- top-left corner and quietly overlap whatever is already there.

alter table public.room_scans
  add column if not exists plan_x numeric,
  add column if not exists plan_y numeric;
