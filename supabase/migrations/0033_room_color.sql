-- Renovision AnA — a per-room colour on the floor plan.
--
-- ORD-37: the reference lets a room be recoloured on its own plan, separate
-- from the damage-cause colours affected areas already carry. Nullable — a
-- room with no colour set draws in the plan's ordinary grey, the same as
-- every room today.

alter table public.room_scans
  add column if not exists room_color text;

notify pgrst, 'reload schema';
