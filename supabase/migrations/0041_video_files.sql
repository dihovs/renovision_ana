-- Renovision AnA — video capture (S7).
--
-- Video was already storable in `project_files` — `content_type` has never
-- been constrained to images, only the app never sent one. Two columns are
-- genuinely new: how long the clip runs (the grid's duration badge, and the
-- report's own caption numbering need to know a row is a video at all
-- without guessing from a MIME string) and where its poster frame lives.
--
-- The poster is its OWN storage object rather than a second `project_files`
-- row — a thumbnail is not a photograph anybody filed, it is a rendering
-- detail of the video beside it, and giving it a row of its own would double
-- every photo count on the grid and the report for no reason.
alter table public.project_files
  add column if not exists duration_seconds integer,
  add column if not exists thumbnail_path text;

notify pgrst, 'reload schema';
