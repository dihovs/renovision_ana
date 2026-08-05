-- Text messages, and the unsubscribe list that has to exist before the first
-- one is sent.
--
-- WHY THIS EXISTS
--
-- The business has an SMS-registered Twilio number and no way to use it. This
-- adds the smallest honest version: the owner types a message to a client in
-- the admin and presses send. Nothing automated, nothing bulk — those need
-- more than a table, and 0021 already shows what "more" looks like when a
-- regulator is involved.
--
-- CASL, AND WHY OPT-OUT IS A TABLE RATHER THAN A FLAG
--
-- CASL governs commercial electronic messages, and s.1(1) defines an
-- electronic address to include a telephone account — a text message is a CEM,
-- not a phone call, and the CRTC's Unsolicited Telecommunications Rules that
-- govern 0021's voice calls are the wrong instrument here. Different statute,
-- different obligations, so this is a separate mechanism rather than a column
-- bolted onto outbound_consents.
--
-- What CASL requires of every CEM (s.6): the sender is identified, contact
-- information is given, and an unsubscribe mechanism is present and works.
-- s.11(2) gives the recipient 60 days to use it and obliges the sender to
-- honour it "without delay" and in any case within 10 business days. Ten days
-- is the ceiling, not the target: this honours STOP on receipt, in the webhook,
-- before anything else happens to the message.
--
-- Consent is NOT modelled as a table here, unlike 0021, and the difference is
-- deliberate. Voice ADAD calls need EXPRESS consent — an affirmative act,
-- evidenced. CASL also recognises IMPLIED consent (s.10(9)), which arises from
-- an existing business relationship: an inquiry in the last six months, or a
-- purchase in the last two years. Every client and lead in this CRM is in the
-- system precisely because they contacted us or bought from us, so the implied
-- consent is a fact about the relationship rather than a row someone has to
-- remember to create. Recording a consent row for each would be theatre.
--
-- What is NOT theatre is the withdrawal: implied consent can be revoked at any
-- moment, and once it is, the number must not be texted again regardless of how
-- good the business relationship looks. Hence a real table, checked on the
-- sending path, and written by the inbound webhook the instant STOP arrives.

-- ---------------------------------------------------------------------------
-- 1. The unsubscribe list.
-- ---------------------------------------------------------------------------
--
-- Keyed on the number and nothing else. Not on client_id: the obligation
-- attaches to the electronic address, so a client who says STOP on their mobile
-- has withdrawn for that number, and a number that later belongs to somebody
-- else is not our judgement call to make. Deliberately survives the client row
-- (no cascade) — deleting a customer must never quietly re-enable texting the
-- number that asked us to stop.

create table if not exists public.sms_opt_outs (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  -- E.164, matching the shape outbound_consents uses so the two lists can be
  -- compared without normalising at read time.
  phone text not null unique check (phone ~ '^\+[1-9][0-9]{7,14}$'),

  -- What they actually sent ("STOP", "ARRET", or a sentence). Stored because
  -- CASL puts the onus on the sender to show the request was honoured, and
  -- "we received something we read as a withdrawal" is a weaker answer than
  -- the words themselves.
  requested_via text,

  -- Set when the owner adds it by hand rather than the recipient texting in.
  note text
);

comment on table public.sms_opt_outs is
  'Numbers that have withdrawn consent to be texted (CASL s.11). Checked before every send.';

-- ---------------------------------------------------------------------------
-- 2. Every message, both directions.
-- ---------------------------------------------------------------------------
--
-- One table rather than sent/received pairs, because the useful view is a
-- conversation with one person in time order, and splitting it would mean a
-- union on every read.

create table if not exists public.sms_messages (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  direction text not null check (direction in ('outbound', 'inbound')),

  -- The other party, always — on an outbound message this is who we texted, on
  -- an inbound one who texted us. Our own number is not stored per row: it is
  -- SITE_PHONE_TEL, and a column repeating it 10,000 times answers no question.
  phone text not null check (phone ~ '^\+[1-9][0-9]{7,14}$'),

  body text not null,

  -- Best-effort attribution. Null is ordinary and not an error: a text can
  -- arrive from a number that belongs to nobody in the CRM yet, and that
  -- message still has to be stored and readable rather than dropped for not
  -- fitting.
  client_id uuid references public.clients(id) on delete set null,
  lead_id   uuid references public.leads(id)   on delete set null,

  -- Twilio's identifier, for reconciling against their console when something
  -- looks wrong. Null on a message that never reached them.
  provider_sid text,

  -- 'queued' the moment Twilio accepts it; 'failed' when the API refuses.
  -- Delivery receipts are a later concern — this records what WE know, and
  -- pretending to know more would make the admin lie.
  status text not null default 'queued'
    check (status in ('queued', 'failed', 'received')),

  -- Why it failed, when it did. Kept so the owner sees "unreachable number"
  -- instead of a message that silently never arrived.
  error text
);

comment on table public.sms_messages is
  'Sent and received text messages. One row per message, both directions.';

-- The two reads this table exists to serve: one person''s thread, and the
-- newest messages across everyone for the inbox.
create index if not exists sms_messages_phone_idx
  on public.sms_messages (phone, created_at desc);
create index if not exists sms_messages_created_idx
  on public.sms_messages (created_at desc);
create index if not exists sms_messages_client_idx
  on public.sms_messages (client_id, created_at desc)
  where client_id is not null;

-- ---------------------------------------------------------------------------
-- 3. Access.
-- ---------------------------------------------------------------------------
--
-- Same posture as every other table here: RLS on with no policies, so the
-- anon and authenticated roles can reach nothing, and the service role the
-- server uses is unaffected by design. Text messages are customer
-- correspondence and there is no browser-side read of them.

alter table public.sms_opt_outs  enable row level security;
alter table public.sms_messages  enable row level security;

grant all on public.sms_opt_outs to service_role;
grant all on public.sms_messages to service_role;
