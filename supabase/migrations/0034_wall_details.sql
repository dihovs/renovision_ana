-- Renovision AnA — a wall is an inspectable thing too.
--
-- ORD-30 / S2. A wall has no id of its own — it is edge N of a room's own
-- polygon, the same indexing `affected_areas.wall_index` already uses — so
-- its details are keyed the same way: (room_scan_id, wall_index) rather than
-- a foreign key to a wall that does not exist as a row anywhere else.
--
-- `display_elevation` is ADDITIVE, not the reference's on/off gate. The
-- report already prints only the walls that carry damage — "the three that
-- are damaged, not twelve" is already true here without this column. What
-- the reference's flag adds on top is a way to include an undamaged wall on
-- purpose (context for an adjacent one); it never suppresses a damaged wall.
create table if not exists public.room_walls (
  id                 uuid primary key default gen_random_uuid(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  room_scan_id       uuid not null references public.room_scans (id) on delete cascade,
  wall_index         integer not null,

  load_bearing       boolean not null default false,
  display_elevation  boolean not null default false,
  notes              text,

  unique (room_scan_id, wall_index)
);

alter table public.room_walls enable row level security;
grant all on public.room_walls to service_role;

-- A wall's own photos, alongside the room's. Nullable and paired with
-- room_scan_id — a wall photo names both, a plain room photo names neither.
alter table public.project_files
  add column if not exists wall_index integer;

create index if not exists project_files_wall_idx
  on public.project_files (room_scan_id, wall_index)
  where wall_index is not null;

notify pgrst, 'reload schema';
