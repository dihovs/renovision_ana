-- Read/unread, kept separate from the pipeline status.
--
-- "I have looked at this" and "this lead is at the quoted stage" are different
-- facts, and collapsing them loses information: a lead can be read and still
-- be new, and marking it read should never advance the pipeline. So this is a
-- timestamp of its own rather than another value in the status enum.
--
-- A nullable timestamp rather than a boolean, because "when did I first see
-- this" answers response-time questions later that a boolean cannot.

alter table public.leads
  add column if not exists opened_at timestamptz;

-- Everything that already exists predates the feature. Leaving these null
-- would show the whole backlog as unread on first load, which is noise rather
-- than signal — the point of the marker is to make genuinely new leads stand
-- out.
update public.leads
   set opened_at = created_at
 where opened_at is null;
