-- device_tokens as 0039 meant it, for tables that predate it.
--
-- 0039 is `create table if not exists`, which is the right guard for a first
-- run and useless for a second: once the table exists the whole statement is
-- skipped, columns and all. The live table was created from an earlier copy
-- of that file and never grew the columns added to it later.
--
-- The cost of that gap was a night. The phone registered on every launch,
-- POST /api/v1/push/tokens wrote disabled_reason, Postgres rejected the
-- write, and the endpoint 500'd -- while the read path, which selects a
-- narrower set, worked fine and reported "no device registered". Server and
-- phone each behaved as though the other were at fault.
--
-- `add column if not exists` is idempotent, so this is safe on a table that
-- is already correct: it is a no-op there and repairs the one that is not.

alter table device_tokens add column if not exists platform text not null default 'ios';
alter table device_tokens add column if not exists bundle_id text;
alter table device_tokens add column if not exists environment text not null default 'development';
alter table device_tokens add column if not exists created_at timestamptz not null default now();
alter table device_tokens add column if not exists last_seen_at timestamptz not null default now();
alter table device_tokens add column if not exists disabled_at timestamptz;
alter table device_tokens add column if not exists disabled_reason text;

create index if not exists device_tokens_live_idx
  on device_tokens (disabled_at, last_seen_at desc);

-- PostgREST caches the schema; without this it keeps rejecting the column it
-- has just been given.
notify pgrst, 'reload schema';
