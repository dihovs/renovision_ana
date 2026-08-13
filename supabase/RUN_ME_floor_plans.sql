-- ============================================================================
-- Renovision AnA — the whole restoration file, in one paste.
--
-- WHAT THIS IS
--   Migrations 0023 to 0029 concatenated, in order, so the whole thing goes
--   into the Supabase SQL editor once instead of seven times. The individual
--   files in supabase/migrations/ are unchanged and remain the source of
--   truth; this is a convenience copy.
--
-- HOW TO RUN IT
--   1. Open your project at supabase.com, then SQL Editor in the left sidebar.
--   2. New query, paste ALL of this, press Run.
--   3. Expect "Success. No rows returned" — these create tables, not results.
--
-- IS IT SAFE TO RUN TWICE?
--   Yes, and safe to run again after an earlier version of this file. Every
--   statement is `create table if not exists`, `add column if not exists`, or
--   `create index if not exists`.
--
--   The one `drop` is `drop constraint if exists`, immediately followed by
--   re-adding that same constraint — the standard way to make a CHECK
--   idempotent. It drops a rule, never a row. There is no DELETE, no
--   TRUNCATE, no DROP TABLE, and no ALTER of an existing column's type.
--
-- WHAT IT TURNS ON
--   0023  estimates tied to a project, and Good/Better/Best tiers
--   0024  room_scans — floor plans have somewhere to live
--   0025  affected_areas — the damaged part of a room, and its square footage
--   0026  claim fields on a project — claim number, carrier, adjuster,
--         category and class of water
--   0027  where each room sits on its floor, once dragged into place
--   0028  photos and notes filed against a room, or one damaged area
--   0029  moisture readings and equipment in/out — the drying record an
--         adjuster needs, and the one magicplan's report has no room for
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

-- ==========================================================================
-- 0028_room_evidence.sql
-- ==========================================================================

-- Renovision AnA — photos and notes on a room, and on the damage itself.
--
-- Photos already attach to a project. That is the right place for a permit
-- or a receipt and the wrong place for the twelve shots taken in the
-- basement: by the time a report is written, "which room was this?" is a
-- question nobody can answer from a filename, and an adjuster looking at an
-- undifferentiated pile of images has no reason to believe any particular
-- one shows the damage being claimed.
--
-- So the same file row can now point at a room, or at a specific affected
-- area within it. Both are NULLABLE and both default to NULL, which means
-- every file that exists today stays exactly what it is — a project file.
-- This is additive; nothing is moved and nothing is reinterpreted.
--
-- One table rather than three: a photo is a photo, and the uploader, the
-- storage bucket, the signed-URL helper and the delete path are already
-- written and tested once. Splitting by what a photo is OF would mean
-- maintaining that machinery three times.

alter table public.project_files
  -- CASCADE: a photo of a room has no meaning once the room is deleted, the
  -- same reasoning the project_id column already uses.
  add column if not exists room_scan_id uuid
    references public.room_scans (id) on delete cascade,

  -- Evidence pinned to one damaged area — the strongest thing a claim file
  -- can carry, because it ties an image to a measured square footage rather
  -- than to a room in general.
  add column if not exists affected_area_id uuid
    references public.affected_areas (id) on delete cascade;

-- Fetching a room's photos is the hot path while writing a report: one query
-- per room, for every room on every floor.
create index if not exists project_files_room_idx
  on public.project_files (room_scan_id, uploaded_at desc)
  where room_scan_id is not null;

create index if not exists project_files_area_idx
  on public.project_files (affected_area_id, uploaded_at desc)
  where affected_area_id is not null;

-- ==========================================================================
-- 0029_drying_log.sql
-- ==========================================================================

-- Renovision AnA — moisture readings and equipment, the drying record.
--
-- The research into what magicplan's report actually contains found no
-- moisture reading, no equipment in or out, and no daily monitoring — and
-- those three are precisely what an adjuster needs to approve a water-damage
-- invoice without argument. A floor plan proves how big the room is. A
-- reading of 38% on day one falling to 14% on day five proves the drying was
-- necessary, was done, and could stop when it did.
--
-- Two tables, because they answer two different questions: what the building
-- was doing, and what equipment was on site while it did it.

-- ---------------------------------------------------------------------------
-- Moisture readings
-- ---------------------------------------------------------------------------
create table if not exists public.moisture_readings (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  -- Against the room, because that is the unit a reading describes and the
  -- unit the report groups by. CASCADE for the same reason as the scans.
  room_scan_id uuid not null references public.room_scans (id) on delete cascade,

  -- When the reading was taken, which is NOT when the row was written: a
  -- technician logs the morning's readings over lunch, and a drying curve
  -- plotted against insert time would be a lie about the building.
  taken_at timestamptz not null default now(),

  -- Where in the room, in the technician's own words: "north wall, 24in up",
  -- "subfloor by the door". Free text on purpose — a fixed list of positions
  -- would be wrong in the first basement that has a bulkhead.
  location text not null default '',

  -- What was measured. Every field is independently nullable because the
  -- instruments differ: a pin meter gives material moisture and nothing else,
  -- a thermo-hygrometer gives air but not material. Storing zero for "not
  -- measured" would put a fabricated reading into a claim file.
  material_percent    numeric,  -- % moisture content of the material itself
  relative_humidity   numeric,  -- % RH of the air
  temperature_c       numeric,  -- °C
  gpp                 numeric,  -- grains per pound, the drying figure proper

  -- Which material was probed — drywall, subfloor, framing. Affects what a
  -- given percentage even means, so a reading without it is hard to defend.
  material text,

  notes text
);

create index if not exists moisture_readings_room_idx
  on public.moisture_readings (room_scan_id, taken_at desc);

-- ---------------------------------------------------------------------------
-- Equipment on site
-- ---------------------------------------------------------------------------
create table if not exists public.equipment_placements (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  -- Against the PROJECT, not the room: equipment gets moved between rooms
  -- during a job, and it is billed per unit per day for the whole time it is
  -- on site. The room it currently sits in is a detail, and nullable.
  project_id   uuid not null references public.projects (id) on delete cascade,
  room_scan_id uuid references public.room_scans (id) on delete set null,

  -- "Air mover", "LGR dehumidifier", "Air scrubber", "Heater". Free text
  -- rather than an enum: the rental catalogue changes and a constraint that
  -- refuses a new machine is a constraint that gets worked around.
  kind text not null,
  -- Asset tag or serial, when the unit has one worth recording.
  identifier text,

  quantity integer not null default 1 check (quantity > 0),

  -- The billable window. out_of_service NULL means still running — which is
  -- also how the report knows to show it as active rather than assuming
  -- today's date and quietly billing a machine that was collected on Tuesday.
  in_service_at  timestamptz not null default now(),
  out_of_service_at timestamptz,

  -- Guards the one error that costs real money in both directions: a unit
  -- collected before it was delivered.
  constraint equipment_window_ordered
    check (out_of_service_at is null or out_of_service_at >= in_service_at),

  notes text
);

create index if not exists equipment_placements_project_idx
  on public.equipment_placements (project_id, in_service_at desc);
