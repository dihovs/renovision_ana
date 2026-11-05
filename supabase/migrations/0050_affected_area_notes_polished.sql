-- The report/estimate AI pass over an affected area's damage notes.
--
-- `notes_polished` is the AI's rewrite, shown in the printed document in
-- place of the operator's own words — which stay in `notes`, untouched,
-- because a note on a claim is evidence and the rewrite is a presentation
-- of it, never a replacement for it.
--
-- `notes_polished_source` is a copy of `notes` AS OF the polish. Comparing
-- it against the current `notes` at render time is the whole cache: equal
-- means the polish is still good, different means the operator edited the
-- note since and it must be redone. No separate "dirty" flag to fall out of
-- step with the text it describes.
alter table affected_areas
  add column if not exists notes_polished text,
  add column if not exists notes_polished_source text;

notify pgrst, 'reload schema';
