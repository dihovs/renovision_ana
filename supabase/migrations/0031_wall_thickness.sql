-- Renovision AnA — wall thickness, per project and per floor.
--
-- The footprint figures (floor area including wall assemblies) need a wall's
-- thickness, and a LiDAR scan measures wall FACES, not assemblies. It cannot
-- know whether a partition is 2x4 or 2x6. So the operator states it, exactly
-- as magicplan does — thickness is a per-floor setting there.
--
-- Shape: a project default plus per-level overrides, because most jobs are one
-- construction throughout and the exception is real — a basement's poured
-- foundation is nothing like the stud walls above it.
--
--   {
--     "default":  { "interiorM": 0.1143, "exteriorM": 0.1778 },
--     "byLevel":  { "Basement": { "interiorM": 0.1143, "exteriorM": 0.2032 } }
--   }
--
-- Nullable: a project that never sets one falls back to the code's default
-- (2x4 partitions, 2x6 exterior), which is what this trade mostly meets.
alter table public.projects
  add column if not exists wall_thickness jsonb;

notify pgrst, 'reload schema';
