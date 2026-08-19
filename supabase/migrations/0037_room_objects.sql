-- Renovision AnA — objects in a room: cabinets, toilets, vanities, appliances.
--
-- ORD-40 / ORD-36 / S8. The thing that made this a table rather than more
-- JSON on the scan: an object is a LINE ITEM, not decoration.
--
-- The owner, asked directly what an object has to do on his jobs, 18 Aug
-- 2026: *"well if replaced, if there is damage, it needs to be counted,
-- there is installation involved also, i need to have an option to include
-- or exclude it like any other item."* Three requirements, and each one has
-- a column here:
--
--   * COUNTED — so it must be a row that can be grouped and totalled, not a
--     blob inside a geometry document that SQL cannot see into.
--   * INSTALLATION — removing a vanity and putting one back are two
--     different costs, and an object that is merely "there" cannot say which
--     happened. `disposition` carries it.
--   * INCLUDE OR EXCLUDE, like any other item — `included`, defaulting to
--     true, the same switch an affected area has. An object that is in the
--     room but not in the claim is an ordinary situation, and the operator
--     must be able to say so without deleting the object off the plan.
--
-- **An object is NOT an opening, and this is the whole reason it needed its
-- own table.** An opening lives IN a wall: it is keyed to an edge index, it
-- knocks a hole in the wall band, and its width and height DEDUCT from net
-- wall area. An object sits ON the floor: it has a position rather than a
-- host edge, it keeps its own height, and it deducts nothing from anything.
-- Modelling the second as the first is how a cabinet would start subtracting
-- wall area that is still there.

create table if not exists public.room_objects (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- CASCADE: an object has no meaning without the room it stands in.
  room_scan_id uuid not null references public.room_scans (id) on delete cascade,

  -- Which catalogue entry this is — a slug like 'toilet' or 'base_cabinet',
  -- resolved against the catalogue in the app rather than a foreign key.
  --
  -- Deliberately NOT an enum or a check constraint. The reference ships a
  -- 300+ object library and this one will grow for years; a check constraint
  -- would mean a migration every time a fixture is added, and a row whose
  -- slug the app does not recognise yet is a drawable box with a name, not a
  -- corrupt record.
  kind text not null,

  -- What the operator called it, when they renamed it. Null means "use the
  -- catalogue entry's own name", so renaming a catalogue entry later does
  -- not orphan old objects on a stale label.
  name text,

  -- Where it stands, in the room's own plan metres — the same coordinate
  -- space affected_areas.polygon uses, so an object lines up with the walls
  -- without any further transform. This is the CENTRE of its footprint.
  x numeric not null default 0,
  y numeric not null default 0,

  -- Degrees clockwise. A vanity against the north wall and the same vanity
  -- against the east wall are one catalogue entry at two rotations.
  rotation numeric not null default 0,

  -- Its own box, in METRES like every other measurement here. Seeded from
  -- the catalogue's stock size and then overridable, because the stock size
  -- is right until the day it is not.
  --
  -- HEIGHT is here and it is not decorative: the owner was explicit that a
  -- cabinet keeps its own height and stands on the floor. It is what a
  -- volume or a disposal figure would be computed from, and it is the
  -- measurement an opening would express as `sill + height` instead.
  width  numeric not null default 0.6,
  depth  numeric not null default 0.6,
  height numeric not null default 0.9,

  -- What is happening to it on this job. This is the "installation
  -- involved" half: an object that is merely present costs nothing, and the
  -- same object removed and reset is two labour lines.
  --
  --   none      — it is in the room, undamaged, nothing to do
  --   remove    — taken out and disposed of
  --   reset     — taken out and put back (a toilet pulled to lift flooring)
  --   replace   — taken out, new one installed
  --   protect   — masked or covered in place
  disposition text not null default 'none'
    check (disposition in ('none','remove','reset','replace','protect')),

  -- In the claim, or not. The owner's own words: "an option to include or
  -- exclude it like any other item". Defaults true because an object placed
  -- on the plan is normally there to be counted; excluding is the deliberate
  -- act, and it must not require deleting the object off the drawing.
  included boolean not null default true,

  -- How many, where one row stands for several identical items — eight
  -- identical base cabinets along one run are one line on an estimate, not
  -- eight rows the operator has to place one at a time. A single placed
  -- object is quantity 1.
  quantity integer not null default 1 check (quantity > 0),

  notes text
);

create index if not exists room_objects_room_idx
  on public.room_objects (room_scan_id);

-- The takeoff query this exists to serve: how many of each kind are in the
-- claim for this room. Partial, because the excluded ones are never counted
-- and there is no reason to walk them.
create index if not exists room_objects_included_idx
  on public.room_objects (room_scan_id, kind)
  where included;

alter table public.room_objects enable row level security;
grant all on public.room_objects to service_role;

-- Or PostgREST serves a stale schema and the app reports a column that
-- exists as missing.
notify pgrst, 'reload schema';
