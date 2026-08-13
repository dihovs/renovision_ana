-- Renovision AnA — moisture readings and equipment, the drying record.
--
-- The research into what magicplan's report actually contains found no
-- moisture reading, no equipment in or out, and no daily monitoring — and
-- those three are precisely what an adjuster needs to approve a water-damage
-- invoice without argument. A floor plan proves how big the room is. A
-- reading of 38% on day one falling to 14% on day five proves the drying was
-- necessary, was done, and could stop when it did.
--
-- Two tables, because they answer two different questions: what the building
-- was doing, and what equipment was on site while it did it.

-- ---------------------------------------------------------------------------
-- Moisture readings
-- ---------------------------------------------------------------------------
create table if not exists public.moisture_readings (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  -- Against the room, because that is the unit a reading describes and the
  -- unit the report groups by. CASCADE for the same reason as the scans.
  room_scan_id uuid not null references public.room_scans (id) on delete cascade,

  -- When the reading was taken, which is NOT when the row was written: a
  -- technician logs the morning's readings over lunch, and a drying curve
  -- plotted against insert time would be a lie about the building.
  taken_at timestamptz not null default now(),

  -- Where in the room, in the technician's own words: "north wall, 24in up",
  -- "subfloor by the door". Free text on purpose — a fixed list of positions
  -- would be wrong in the first basement that has a bulkhead.
  location text not null default '',

  -- What was measured. Every field is independently nullable because the
  -- instruments differ: a pin meter gives material moisture and nothing else,
  -- a thermo-hygrometer gives air but not material. Storing zero for "not
  -- measured" would put a fabricated reading into a claim file.
  material_percent    numeric,  -- % moisture content of the material itself
  relative_humidity   numeric,  -- % RH of the air
  temperature_c       numeric,  -- °C
  gpp                 numeric,  -- grains per pound, the drying figure proper

  -- Which material was probed — drywall, subfloor, framing. Affects what a
  -- given percentage even means, so a reading without it is hard to defend.
  material text,

  notes text
);

create index if not exists moisture_readings_room_idx
  on public.moisture_readings (room_scan_id, taken_at desc);

-- ---------------------------------------------------------------------------
-- Equipment on site
-- ---------------------------------------------------------------------------
create table if not exists public.equipment_placements (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  -- Against the PROJECT, not the room: equipment gets moved between rooms
  -- during a job, and it is billed per unit per day for the whole time it is
  -- on site. The room it currently sits in is a detail, and nullable.
  project_id   uuid not null references public.projects (id) on delete cascade,
  room_scan_id uuid references public.room_scans (id) on delete set null,

  -- "Air mover", "LGR dehumidifier", "Air scrubber", "Heater". Free text
  -- rather than an enum: the rental catalogue changes and a constraint that
  -- refuses a new machine is a constraint that gets worked around.
  kind text not null,
  -- Asset tag or serial, when the unit has one worth recording.
  identifier text,

  quantity integer not null default 1 check (quantity > 0),

  -- The billable window. out_of_service NULL means still running — which is
  -- also how the report knows to show it as active rather than assuming
  -- today's date and quietly billing a machine that was collected on Tuesday.
  in_service_at  timestamptz not null default now(),
  out_of_service_at timestamptz,

  -- Guards the one error that costs real money in both directions: a unit
  -- collected before it was delivered.
  constraint equipment_window_ordered
    check (out_of_service_at is null or out_of_service_at >= in_service_at),

  notes text
);

create index if not exists equipment_placements_project_idx
  on public.equipment_placements (project_id, in_service_at desc);
