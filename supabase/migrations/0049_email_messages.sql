-- The owner's mail, ingested. (ANA-06)
--
-- The fourth channel, and the one the whole workstream was described around:
-- "someone messages on Teams, then they reply on the email". After this
-- migration both halves of that sentence land in tables that
-- searchConversations merges, joined to one person by 0046.
--
-- WHAT IS STORED IS WHAT ANSWERS QUESTIONS, and nothing else: who, when,
-- subject, the words, and the NAMES of attachments. Attachment bytes never
-- land here — a mailbox's attachments are a filesystem, and Ana finding "the
-- adjuster sent plan.pdf Tuesday" does not require holding plan.pdf.
--
-- WHY BODY CARRIES THE SUBJECT ON ITS FIRST LINE. Half of a mail's signal is
-- its subject line, and the search path is one ilike over `body` (the same
-- shape every other channel uses). Prefixing the subject at sync time makes
-- subject hits fall out of the existing search for free, keeps the transcript
-- reading naturally ("Re: Fleury bathroom" as the first line), and costs a few
-- duplicated bytes — the subject column stays for anything that needs it alone.
--
-- EMAIL IS THE WIDEST UNTRUSTED INPUT IN THE SYSTEM. Anyone on earth can put a
-- row in this table by sending mail. What keeps that safe is not this schema:
-- it is that everything reading it treats a message as a quote, never a fact,
-- never an instruction (ownerTools.ts header, ANA-01's write boundary). Stated
-- here because this table is where that input enters.

create table if not exists public.email_messages (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  -- Graph's message id. Unique for the same reason as every other channel:
  -- overlapping sync windows must update nothing rather than duplicate.
  graph_message_id text not null unique,

  -- Graph's conversationId — what stitches a back-and-forth into one thread.
  thread_id text,

  direction text not null check (direction in ('inbound','outbound')),

  from_address text,
  from_name    text,
  -- Plain addresses, lowercased. Enough to resolve people and to say who was
  -- on the thread; display names for recipients add little and rot fast.
  to_addresses text[] not null default '{}',

  -- The other end of the conversation, denormalised for the transcript line:
  -- sender for inbound, first recipient for outbound.
  counterpart_name text,

  -- The identity join (0046): sender for inbound, first recipient for
  -- outbound. Null is ordinary — a newsletter, a no-reply, a failed resolve —
  -- and the message stays readable either way.
  person_id uuid references public.people (id) on delete set null,

  -- Never set by the sync; filing mail against a job is a human act.
  job_id uuid references public.jobs (id) on delete set null,

  subject text,
  -- Plain text, subject-prefixed (see above), capped at sync time. The HTML is
  -- not kept: signatures, tracking pixels and styling are not information.
  body text,

  -- "file: plan.pdf, photos.zip" — named, never described or opened.
  attachment text,

  sent_at timestamptz not null
);

create index if not exists email_messages_sent_idx   on public.email_messages (sent_at desc);
create index if not exists email_messages_thread_idx on public.email_messages (thread_id, sent_at desc);
create index if not exists email_messages_person_idx on public.email_messages (person_id);
create index if not exists email_messages_job_idx    on public.email_messages (job_id);

-- ---------------------------------------------------------------------------
-- Access — both halves, per the 0040/0046 lesson
-- ---------------------------------------------------------------------------

alter table public.email_messages enable row level security;

grant select, insert, update, delete on table public.email_messages to service_role;

notify pgrst, 'reload schema';
