-- WhatsApp: subcontractor coordination, filed against the job it belongs to.
--
-- This is the company WhatsApp used to send instructions out to subs and get
-- photos, notes and progress back. Today those threads live on a phone, which
-- means the record of what a sub was told about a job dies with the handset and
-- cannot be searched, attached to an invoice dispute, or read by anyone else.
--
-- A PRIVACY NOTE THAT BELONGS IN THE SCHEMA, not just the docs: unlike the
-- lead-photo path — browser straight to Supabase in Montreal, no third party —
-- every WhatsApp message is decrypted by Meta's Cloud API and rests on their
-- servers, outside Canada, for up to 30 days. The photos are of the inside of
-- customers' homes. Under Quebec's Law 25 the company is the controller and
-- owes an assessment and a disclosure. Copying the media into our own private
-- bucket, as this schema does, is what makes OUR copy defensible; it does not
-- retract Meta's.

-- ---------------------------------------------------------------------------
-- Contacts — who is on the other end
-- ---------------------------------------------------------------------------
--
-- Separate from clients: a subcontractor is not a customer, and putting them in
-- the same table would put a plumber into the quote picker.

create table if not exists public.whatsapp_contacts (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- E.164 without the +, which is the shape Meta sends.
  wa_id text not null unique,

  -- What WhatsApp reports as their profile name, and what we choose to call
  -- them. Two columns because the profile name is whatever they set it to and
  -- "Mike" is not a useful label on a job thread.
  profile_name text,
  display_name text,

  role text not null default 'subcontractor'
       check (role in ('subcontractor','supplier','client','other')),

  -- Business-initiated messages need documented consent (Meta's rules, and
  -- ordinary good manners). Null means never opted in — which is legal to
  -- reply to, but not to message first.
  opted_in_at timestamptz,
  opt_in_source text,

  notes text,
  archived_at timestamptz
);

create index if not exists wa_contacts_wa_id_idx on public.whatsapp_contacts (wa_id);
alter table public.whatsapp_contacts enable row level security;

-- ---------------------------------------------------------------------------
-- Messages
-- ---------------------------------------------------------------------------

create table if not exists public.whatsapp_messages (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  -- Meta's id. Unique because their webhooks retry, and a retried delivery must
  -- update the existing row rather than duplicate the message in the thread.
  wa_message_id text unique,

  contact_id uuid references public.whatsapp_contacts (id) on delete set null,

  -- Which job this belongs to. Nullable: a message arrives before anyone has
  -- said which job it is about, and forcing a guess at insert time would file
  -- half of them wrong. Unfiled messages surface in an inbox for one tap.
  job_id uuid references public.jobs (id) on delete set null,

  direction text not null check (direction in ('inbound','outbound')),
  kind      text not null default 'text'
            check (kind in ('text','image','video','audio','document','location','other')),

  body text,

  -- Media is COPIED into our own private bucket rather than linked. Meta's
  -- media URLs expire in minutes, so a stored link would be a broken image by
  -- the time anyone looked at it.
  media_path      text,
  media_mime      text,
  media_caption   text,

  -- Meta's own timestamp, which is when the sub actually sent it — not when our
  -- webhook happened to run.
  sent_at    timestamptz not null default now(),
  -- sent -> delivered -> read, for outbound only.
  status     text,

  -- Set when the message could not be filed automatically, so the inbox can
  -- show what still needs a human.
  needs_filing boolean not null default false
);

create index if not exists wa_messages_job_idx     on public.whatsapp_messages (job_id, sent_at);
create index if not exists wa_messages_contact_idx on public.whatsapp_messages (contact_id, sent_at desc);
create index if not exists wa_messages_filing_idx  on public.whatsapp_messages (needs_filing)
  where needs_filing;

alter table public.whatsapp_messages enable row level security;

-- ---------------------------------------------------------------------------
-- Thread summaries
-- ---------------------------------------------------------------------------
--
-- Claude's overview of a job's WhatsApp thread, so the job page can show what
-- happened without making anyone scroll two hundred messages.
--
-- Cached rather than generated on every page load: the thread only changes when
-- a message arrives, and re-summarising an unchanged conversation is spending
-- money to produce the same paragraph. `message_count` is the cheap staleness
-- check — when it no longer matches, the summary is out of date.

create table if not exists public.whatsapp_summaries (
  job_id        uuid primary key references public.jobs (id) on delete cascade,
  summary       text not null,
  message_count integer not null default 0,
  generated_at  timestamptz not null default now()
);

alter table public.whatsapp_summaries enable row level security;

grant all on public.whatsapp_contacts  to service_role;
grant all on public.whatsapp_messages  to service_role;
grant all on public.whatsapp_summaries to service_role;

drop trigger if exists wa_contacts_touch_updated_at on public.whatsapp_contacts;
create trigger wa_contacts_touch_updated_at
  before update on public.whatsapp_contacts
  for each row execute function public.touch_updated_at();
