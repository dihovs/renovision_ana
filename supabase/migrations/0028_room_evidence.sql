-- Renovision AnA — photos and notes on a room, and on the damage itself.
--
-- Photos already attach to a project. That is the right place for a permit
-- or a receipt and the wrong place for the twelve shots taken in the
-- basement: by the time a report is written, "which room was this?" is a
-- question nobody can answer from a filename, and an adjuster looking at an
-- undifferentiated pile of images has no reason to believe any particular
-- one shows the damage being claimed.
--
-- So the same file row can now point at a room, or at a specific affected
-- area within it. Both are NULLABLE and both default to NULL, which means
-- every file that exists today stays exactly what it is — a project file.
-- This is additive; nothing is moved and nothing is reinterpreted.
--
-- One table rather than three: a photo is a photo, and the uploader, the
-- storage bucket, the signed-URL helper and the delete path are already
-- written and tested once. Splitting by what a photo is OF would mean
-- maintaining that machinery three times.

alter table public.project_files
  -- CASCADE: a photo of a room has no meaning once the room is deleted, the
  -- same reasoning the project_id column already uses.
  add column if not exists room_scan_id uuid
    references public.room_scans (id) on delete cascade,

  -- Evidence pinned to one damaged area — the strongest thing a claim file
  -- can carry, because it ties an image to a measured square footage rather
  -- than to a room in general.
  add column if not exists affected_area_id uuid
    references public.affected_areas (id) on delete cascade;

-- Fetching a room's photos is the hot path while writing a report: one query
-- per room, for every room on every floor.
create index if not exists project_files_room_idx
  on public.project_files (room_scan_id, uploaded_at desc)
  where room_scan_id is not null;

create index if not exists project_files_area_idx
  on public.project_files (affected_area_id, uploaded_at desc)
  where affected_area_id is not null;
