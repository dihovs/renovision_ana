-- Renovision AnA — a hand-measured object size is a different fact from a
-- catalogue guess.
--
-- ORD-40 / S8. The owner asked for both halves of this in one breath:
-- *"let's say when you choose a dishwasher or a fridge, we can actually
-- choose what size it is… And also I need to have a place that actually we
-- can adjust and put it manually in case we get something weird that is not
-- a standard size."*
--
-- The first half is catalogue entries — 30in, 33in, 36in fridges are three
-- rows in the app's own list and need nothing from the database. This is the
-- second half.
--
-- **Why a column rather than comparing against the catalogue.** It is
-- tempting to infer "hand-set" by checking whether the stored size differs
-- from the entry's stock size, and it would work today. But the catalogue is
-- a list in the app that will keep growing and being corrected, and the day
-- someone fixes a stock depth, every object placed before it would silently
-- start reading as hand-measured. A claim figure must not change meaning
-- because an unrelated constant was edited.
--
-- The precedent is the wall padlock: this project already distinguishes a
-- measured length from a typed one, because an adjuster is entitled to know
-- which is which. An object is no different — 36in because the catalogue
-- said so, and 36in because somebody put a tape on it, are not the same
-- claim.
alter table public.room_objects
  add column if not exists size_hand_set boolean not null default false;

notify pgrst, 'reload schema';
