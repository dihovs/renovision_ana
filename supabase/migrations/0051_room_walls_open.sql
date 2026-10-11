-- Renovision AnA — a wall can be open: the room's edge, with no wall on it.
--
-- An open-plan entry that runs straight into the dining room still has a
-- boundary — it is where one room's floor area stops and the next one's
-- starts — but nothing stands on it: nothing to paint, no board, no
-- baseboard. Until now every edge of every room was a wall, so an open-plan
-- floor printed walls that do not exist and priced paint and trim along them.
--
-- A flag on the wall's own row, like load_bearing beside it: a wall has no
-- id, it is edge N of its room's polygon (see 0034). Default false, so every
-- wall that exists today stays a wall and every room keeps its numbers.
--
-- The server recomputes the room's wall_length_m when a side is opened or
-- closed (lib/openWalls.ts), so wall area and baseboard follow without any
-- reader having to know this column exists — including the phone, which
-- reads the column and ignores fields it does not know.
alter table public.room_walls
  add column if not exists is_open boolean not null default false;

notify pgrst, 'reload schema';
