-- One human, however they reach us. (ANA-02)
--
-- A conversation starts in Teams, is followed up by email, and the owner relays
-- it to the crew on WhatsApp. Three systems, three identifiers, one person —
-- and nothing in this database has ever said so. `whatsapp_contacts` keys on a
-- wa_id, `sms_messages` points straight at a client, and an email address
-- appears only inside the `clients.emails` json blob. Ask "what has this person
-- said to us" and there is no join to make.
--
-- This is that join. Everything in Ana's cross-channel work (see
-- Docs/Ana-Capabilities-Orders.md, Part 3) reads from these two tables.
--
-- WHY A PERSON IS NOT A CLIENT
--
-- A client is a company or a household that gets invoiced. A person is a human
-- with a phone. One client has several people — the husband who books, the wife
-- who is home for the visit, the office manager who pays. And plenty of people
-- are not clients at all: subcontractors, suppliers, the insurance adjuster.
-- Folding people into `clients` would mean inventing a client row for the
-- adjuster, which is how a customer list stops meaning anything.
--
-- WHY IDENTIFIERS ARE MATCHED EXACTLY AND NAMES ARE NOT
--
-- `contactMatch.ts` turns a spoken name into a client and is deliberately
-- fuzzy, because speech is lossy and "Trombley" is how a phone hears Tremblay.
-- Nothing here is fuzzy. An email address either is or is not the one we have.
-- The unique constraint on (kind, value) is what makes that true: one
-- identifier belongs to at most one person, and a second claim on it is a
-- failed insert somebody looks at, not a silent merge of two humans.

-- ---------------------------------------------------------------------------
-- The person
-- ---------------------------------------------------------------------------

create table if not exists public.people (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- What to call them out loud. Not a name to match on — that is what
  -- person_identities is for — just what Ana says and the admin shows.
  display_name text,

  -- The client they belong to, when they belong to one. Nullable and expected
  -- to be null often: a subcontractor is a person and not a customer, and an
  -- unknown number that texts us is a person before anyone decides who.
  client_id uuid references public.clients (id) on delete set null,

  -- Free text for the operator. "Adjuster on the Fleury claim", "Mike's brother".
  notes text
);

create index if not exists people_client_idx on public.people (client_id);

-- Maintained in the database, like every other updated_at here: 0004 set the
-- convention and an update that forgets to touch the column is invisible until
-- a list sorts wrong weeks later.
drop trigger if exists people_touch_updated_at on public.people;
create trigger people_touch_updated_at
  before update on public.people
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- The identifiers that reach them
-- ---------------------------------------------------------------------------

create table if not exists public.person_identities (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  person_id uuid not null references public.people (id) on delete cascade,

  -- The five ways a human currently arrives. `phone` covers SMS and voice;
  -- `whatsapp_wa_id` is kept separate from `phone` because Meta's id is the
  -- number WITHOUT the plus and equating the two by eye is how a join silently
  -- returns nothing. Both are written, so either lookup finds the person.
  kind text not null
       check (kind in ('email','phone','teams_user_id','whatsapp_wa_id','ms_upn')),

  -- Normalised before it gets here, never on the way out: lowercased for
  -- addresses and Entra ids, E.164 for phones, digits only for wa_id. The
  -- normaliser is `src/lib/crm/people.ts` and there is deliberately only one.
  value text not null,

  -- Where we learned it, for the day somebody asks why we have this address.
  source text,

  -- ONE IDENTIFIER, ONE PERSON. The whole design rests on this line.
  unique (kind, value)
);

create index if not exists person_identities_person_idx
  on public.person_identities (person_id);

-- ---------------------------------------------------------------------------
-- Messages point at a person
-- ---------------------------------------------------------------------------
--
-- Nullable everywhere, and that is not a shortcut. A message from a number
-- nobody has met still has to be stored and readable — dropping it for not
-- fitting is how an inbox starts lying. `needs_filing` already models exactly
-- this for WhatsApp.

alter table public.whatsapp_contacts
  add column if not exists person_id uuid references public.people (id) on delete set null;

alter table public.sms_messages
  add column if not exists person_id uuid references public.people (id) on delete set null;

-- WhatsApp messages have carried a job_id since 0010; texts never could, so a
-- customer's text about a job has been unfilable. Ana's record_brief needs both
-- halves of that conversation under the same job.
alter table public.sms_messages
  add column if not exists job_id uuid references public.jobs (id) on delete set null;

create index if not exists whatsapp_contacts_person_idx
  on public.whatsapp_contacts (person_id);
create index if not exists sms_messages_person_idx on public.sms_messages (person_id);
create index if not exists sms_messages_job_idx    on public.sms_messages (job_id);

-- ---------------------------------------------------------------------------
-- Backfill
-- ---------------------------------------------------------------------------
--
-- WHAT IS DONE HERE AND WHAT IS NOT. Two of the three sources are already
-- normalised at rest and can be trusted by plain SQL: Meta normalises wa_id to
-- digits, and sms_messages.phone carries a check constraint pinning it to
-- E.164. Those are copied below.
--
-- `clients.phones` is not. It holds whatever a human typed — "(514) 555-1234",
-- an extension, a fax — and turning that into E.164 is `toE164` in
-- src/lib/phone.ts, which rejects +1055 as a typo and refuses anything with an
-- extension for reasons that took a paragraph of comment to justify. Writing a
-- second, subtly different normaliser in SQL is how the two stop agreeing, so
-- client phones are backfilled by `backfillClientPhones()` in
-- src/lib/crm/people.ts instead, using that one implementation.

-- One person per client, so an existing customer is a person from the start.
insert into public.people (client_id, display_name)
select c.id,
       coalesce(
         nullif(trim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, '')), ''),
         c.company_name
       )
from public.clients c
where not exists (select 1 from public.people p where p.client_id = c.id);

-- Their email addresses, out of the json array and into a column that joins.
insert into public.person_identities (person_id, kind, value, source)
select p.id, 'email', lower(trim(e ->> 'address')), 'clients.emails'
from public.clients c
join public.people p on p.client_id = c.id
cross join lateral jsonb_array_elements(c.emails) e
where nullif(trim(e ->> 'address'), '') is not null
on conflict (kind, value) do nothing;

-- Everyone we have a WhatsApp thread with.
--
-- Row by row rather than as a set, because each contact needs the person it
-- just created and a set-based version has to match them back up afterwards —
-- by display_name, which is null for plenty of contacts and identical for
-- others. Two hundred rows once; correctness is worth more than the round trips.
--
-- Two identities per contact: Meta's wa_id, and the same number as a phone.
-- That second one is the whole point — it is what makes a text and a WhatsApp
-- message from one human land on one person.
do $$
declare
  contact  record;
  found_id uuid;
begin
  for contact in
    select id, wa_id, coalesce(display_name, profile_name) as name
    from public.whatsapp_contacts
    where person_id is null
  loop
    -- Already known? Either identifier is enough to recognise them.
    select i.person_id into found_id
    from public.person_identities i
    where (i.kind = 'whatsapp_wa_id' and i.value = contact.wa_id)
       or (i.kind = 'phone' and i.value = '+' || contact.wa_id)
    limit 1;

    if found_id is null then
      insert into public.people (display_name) values (contact.name) returning id into found_id;
    elsif contact.name is not null then
      update public.people set display_name = coalesce(display_name, contact.name)
      where id = found_id;
    end if;

    insert into public.person_identities (person_id, kind, value, source)
    values (found_id, 'whatsapp_wa_id', contact.wa_id, 'whatsapp_contacts')
    on conflict (kind, value) do nothing;

    -- wa_id is E.164 with the plus stripped, so it is safe to put back. Guarded
    -- because a malformed id must not become a phone number nobody can dial.
    if contact.wa_id ~ '^[1-9][0-9]{7,14}$' then
      insert into public.person_identities (person_id, kind, value, source)
      values (found_id, 'phone', '+' || contact.wa_id, 'whatsapp_contacts.wa_id')
      on conflict (kind, value) do nothing;
    end if;

    update public.whatsapp_contacts set person_id = found_id where id = contact.id;
  end loop;
end $$;

-- Numbers that have texted us and belong to nobody yet. The lookup before the
-- insert is the join doing its job: a number already known from WhatsApp or a
-- client record is that same person, and no second person is created for it.
do $$
declare
  candidate  text;
  new_person uuid;
begin
  for candidate in
    select distinct s.phone
    from public.sms_messages s
    where not exists (
      select 1 from public.person_identities i
      where i.kind = 'phone' and i.value = s.phone
    )
  loop
    insert into public.people (display_name) values (null) returning id into new_person;
    insert into public.person_identities (person_id, kind, value, source)
    values (new_person, 'phone', candidate, 'sms_messages')
    on conflict (kind, value) do nothing;
  end loop;
end $$;

-- Now every text can point at whoever sent it.
update public.sms_messages s
set person_id = i.person_id
from public.person_identities i
where s.person_id is null
  and i.kind = 'phone'
  and i.value = s.phone;

-- And a text from a known client attaches that person to the client, when the
-- person does not already belong to a different one.
update public.people p
set client_id = s.client_id
from public.sms_messages s
where s.person_id = p.id
  and p.client_id is null
  and s.client_id is not null;
