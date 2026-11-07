-- Renovision AnA — wall thickness per storey.
--
-- magicplan states wall thickness per FLOOR, interior and exterior kept
-- apart (Docs/Magicplan-Screen-Spec.md, "Interior / exterior wall thickness —
-- per floor, not per wall"). A scan sees wall faces and cannot know what is
-- inside them, so this is the operator's statement, not a measurement.
--
-- It rides on floor_display (0043) because that is already the one row per
-- storey (project_id, level). Null means "never stated": the app then draws
-- the trade default, 2x4 partitions (0.1143 m) and 2x6 exterior with
-- sheathing (0.1778 m) — see src/lib/crm/wallThickness.ts.

alter table public.floor_display add column if not exists interior_wall_m numeric;
alter table public.floor_display add column if not exists exterior_wall_m numeric;

alter table public.floor_display drop constraint if exists floor_display_wall_range;
alter table public.floor_display add constraint floor_display_wall_range check (
  (interior_wall_m is null or (interior_wall_m > 0.03 and interior_wall_m < 0.6)) and
  (exterior_wall_m is null or (exterior_wall_m > 0.03 and exterior_wall_m < 0.8))
);

notify pgrst, 'reload schema';
