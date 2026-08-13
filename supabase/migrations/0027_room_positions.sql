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
