-- Apple's own scan record, kept beside the room it produced.
--
-- WHY (owner, 3 Nov 2026). room_scans.geometry is OUR reading of a RoomPlan
-- scan: a centre, an axis and a length per wall, after our own corrections.
-- Every time that reading has improved, rooms saved under the old one were
-- stuck with it, because the scan itself was never kept. RoomPlan's
-- CapturedRoom is Codable; this keeps its JSON, untouched, so an old room
-- can be re-run through a better conversion instead of re-scanned.
--
-- WHY A TABLE AND NOT A COLUMN. Two readers load room_scans with select("*")
-- (lib/crm/roomScans.ts, lib/crm/projects.ts). A column here would ship tens
-- of kilobytes per room to every project screen, for data nothing draws
-- from. A table of its own is only read by whoever asks for it by name.
--
-- One row per room, deleted with it. Rooms drawn by hand, imported from a
-- plan, or scanned before this migration simply have no row.

create table if not exists public.room_scan_captures (
  room_scan_id uuid primary key references public.room_scans (id) on delete cascade,
  created_at   timestamptz not null default now(),
  -- 'roomplan.capturedRoom' today. Named so a CapturedStructure (a merged
  -- multi-room scan) or a later format can live here without guessing.
  format       text not null default 'roomplan.capturedRoom',
  capture      jsonb not null
);

alter table public.room_scan_captures enable row level security;
grant all on public.room_scan_captures to service_role;

notify pgrst, 'reload schema';
