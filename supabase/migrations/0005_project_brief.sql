-- The AI's handover note on each lead.
--
-- The full conversation was already being forwarded, and that turned out to be
-- the wrong thing: reading twenty exchanges to find out which room it was is
-- work, not information. This column holds what the assistant actually
-- established — room, dimensions, materials, condition, whether there was
-- water — in job-sheet form, plus the questions it could not answer.
--
-- jsonb rather than columns because the shape varies by trade. A water-damage
-- brief records how long it has been wet; a flooring brief records the
-- subfloor. Fixed columns would be null for most jobs and still miss the one
-- fact that mattered.
--
-- Shape (validated in src/lib/projectBrief.ts, not here):
--   { headline: string,
--     facts: [{ label, value }],
--     customerWords?: string,
--     openQuestions?: string[] }

alter table public.leads
  add column if not exists project_brief jsonb;

-- Deliberately NOT backfilled. Existing leads have no brief, and inventing one
-- from the estimate would put words in the customer's mouth. Null here means
-- "captured before this existed", which is the truth.
