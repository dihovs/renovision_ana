-- Renovision AnA — which way a storey is turned on screen.
--
-- The floor plan can be turned to fit the drawing on a phone, or simply
-- because it reads better rotated — the owner's four reference frames swap
-- "Other" and "Living Room" from side to side and nothing else. That is a
-- fact about how the storey is DRAWN, not a fact about the building: the
-- rooms did not move, their walls did not change shape, nothing was
-- measured differently.
--
-- Turning used to be written the same way a corrected wall is — rotating
-- every room's polygon and re-saving it through saveEditedPlan — which
-- meant a turn silently overwrote the RoomPlan scan underneath it. A floor
-- turned this way lost 26 auto-detected objects with no way back: the scan
-- geometry that RoomPlan detected them from was gone, and the floor could
-- not be re-scanned to recover it.
--
-- So the angle gets its own row instead, one per storey — a storey being
-- (project_id, level), since nothing in this schema models a floor as an
-- entity of its own (see room_scans.level and lib/crm/floors.ts). Turning a
-- floor becomes a write of ONE number, not a rewrite of every room on it,
-- and the class of data loss becomes impossible rather than merely rarer.
--
-- Degrees, not radians — every other angle stored in this schema
-- (room_objects.rotation) is degrees, and there is no reason for this one
-- to be the odd one out. 0 is upright and is also the default for a floor
-- nobody has ever turned, which is indistinguishable from a floor turned
-- back to upright — both are the same fact. A floor already rotated by the
-- OLD destructive path before this migration landed is NOT retroactively
-- fixed: its rooms' stored geometry is now the only truth that exists, and
-- 0 here correctly means "draw that data upright." A new turn from here
-- stacks on top of it like any other floor.

create table if not exists public.floor_display (
  project_id uuid not null references public.projects (id) on delete cascade,
  level text not null,
  display_angle numeric not null default 0,
  updated_at timestamptz not null default now(),
  primary key (project_id, level)
);

alter table public.floor_display enable row level security;
grant all on public.floor_display to service_role;

-- Or PostgREST serves a stale schema and the app reports a column that
-- exists as missing.
notify pgrst, 'reload schema';
