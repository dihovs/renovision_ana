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
