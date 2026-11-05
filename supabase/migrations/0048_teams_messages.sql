-- Teams chat, ingested. (ANA-05)
--
-- The third channel, and the first one that arrives by polling rather than by
-- webhook: WhatsApp and SMS are pushed at us by Meta and Twilio, Teams is
-- pulled from Graph on the cron. Same destination either way — a per-channel
-- table that searchConversations merges on the way out, so Ana answers "what
-- did he say" without caring which app it was said in.
--
-- 1:1 AND GROUP CHATS ONLY, and no meeting chats. The owner confirmed on
-- 30 Aug 2026 that people message him directly rather than in team channels,
-- so channel messages are not requested (no ChannelMessage.Read.All — see
-- src/lib/microsoft/scopes.ts). Meeting chats are skipped by the sync because
-- they are the chat surface of a call, and calls are the thing the owner
-- explicitly ruled out.
--
-- WHY SENDER AND COUNTERPART ARE BOTH STORED. `who said it` and `who the
-- conversation is with` differ on an outbound message: the sender is the owner,
-- but the useful label is the person he was talking to. WhatsApp gets this for
-- free because a thread belongs to a contact; a Teams chat belongs to its
-- members, so the other party is resolved at sync time and denormalised here.

create table if not exists public.teams_messages (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  -- Graph's message id. Unique because the sync overlaps its windows on
  -- purpose (clock skew, retried runs), and a message seen twice must update
  -- nothing rather than appear twice in a thread.
  graph_message_id text not null unique,

  chat_id    text not null,
  chat_type  text not null check (chat_type in ('oneOnOne','group')),
  chat_topic text,

  direction text not null check (direction in ('inbound','outbound')),

  -- Who actually spoke. In a group chat this is the interesting half.
  sender_aad_id text,
  sender_name   text,

  -- Who the conversation is with: the other member of a oneOnOne, the topic of
  -- a group. What `asTranscript` shows on an outbound line.
  counterpart_name text,

  -- The identity join (0046). Set for inbound messages whose sender resolved
  -- or was created; null is ordinary — a bot, or a sender resolution that
  -- failed — and the message is kept readable either way.
  person_id uuid references public.people (id) on delete set null,

  -- Never set by the sync. Filing a Teams message against a job is a human
  -- act in the admin, same as WhatsApp's needs_filing inbox.
  job_id uuid references public.jobs (id) on delete set null,

  -- Plain text, already stripped from Graph's HTML by the sync. The HTML is
  -- not kept: it is Teams markup, not information.
  body text,

  -- "file: plan.pdf" — named, never described. Nothing has looked inside it.
  attachment text,

  -- Graph's own timestamp: when it was said, not when we happened to sync.
  sent_at timestamptz not null
);

create index if not exists teams_messages_sent_idx    on public.teams_messages (sent_at desc);
create index if not exists teams_messages_chat_idx    on public.teams_messages (chat_id, sent_at desc);
create index if not exists teams_messages_person_idx  on public.teams_messages (person_id);
create index if not exists teams_messages_job_idx     on public.teams_messages (job_id);

-- ---------------------------------------------------------------------------
-- Access — both halves, per the 0040/0046 lesson
-- ---------------------------------------------------------------------------

alter table public.teams_messages enable row level security;

grant select, insert, update, delete on table public.teams_messages to service_role;

notify pgrst, 'reload schema';
