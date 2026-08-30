-- The number a customer reads back to Ana.
--
-- The estimator hands one out at the end of a chat; the caller says it on the
-- phone; Ana looks it up. leads.id is a uuid and cannot make that trip, so this
-- is a second identity for the same row -- see src/lib/leads/reference.ts for
-- why it is six digits with no letters and no leading zero.
--
-- Nullable, because a lead can arrive without one: postCallLead writes a lead
-- from a phone call that never touched the estimator, and there is nobody to
-- hand a reference to. Unique, so a collision is a failed insert the caller
-- retries rather than two customers sharing a number -- which is the only check
-- that survives two requests landing at once.

alter table public.leads add column if not exists reference text;

create unique index if not exists leads_reference_idx
  on public.leads (reference)
  where reference is not null;

-- Existing leads get one too. They predate the estimator handing them out, so
-- nobody has these numbers -- but a lead the owner is still working can be
-- asked about, and "I can't find it" would be a lie about a row we have.
--
-- Generated in a loop rather than one update: a random six-digit value can
-- collide, and doing it a row at a time lets the unique index catch it and the
-- loop try again, which set-based generation cannot.
do $$
declare
  target uuid;
  candidate text;
begin
  for target in select id from public.leads where reference is null loop
    loop
      candidate := (100000 + floor(random() * 900000))::int::text;
      begin
        update public.leads set reference = candidate where id = target;
        exit;
      exception when unique_violation then
        -- try another
      end;
    end loop;
  end loop;
end $$;

notify pgrst, 'reload schema';
