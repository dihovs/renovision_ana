-- Renovision AnA — per-area dimension display.
--
-- ORD-32: whether an affected area's width/height print on the wall
-- elevation. Off by default — most areas are marked to record where the
-- damage is, not to be measured against; turning this on is a deliberate
-- choice for the areas that matter to an estimate.

alter table public.affected_areas
  add column if not exists show_dimensions boolean not null default false;

notify pgrst, 'reload schema';
