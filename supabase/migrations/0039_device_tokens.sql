-- Where a push notification is delivered.
--
-- The owner asked for notifications on his phone, 20 Aug 2026: "I wanna get
-- notifications so I can go and actually check what's going on." SMS alerts
-- ship today (src/lib/notify/owner.ts); this is the row that makes a real
-- banner possible.
--
-- One row per DEVICE, not per person. This app has one operator and no user
-- table, and a token belongs to an install anyway: the same person on a new
-- phone is a new token, and the old one has to be retired rather than
-- reassigned.

create table if not exists device_tokens (
  id uuid primary key default gen_random_uuid(),
  -- APNs device token, hex. Unique because Apple reissues the same token to
  -- the same install on every launch, and every launch registers.
  token text not null unique,
  platform text not null default 'ios',
  -- Which app the token is for. Kept because a token is only valid for the
  -- bundle it was issued to, and sending to the wrong one is a hard failure
  -- from Apple rather than a silent no-op.
  bundle_id text,
  -- 'development' or 'production'. A token minted against the sandbox is
  -- rejected outright by the production gateway and the other way round,
  -- which is the single most common way push "just doesn't work".
  environment text not null default 'development',
  created_at timestamptz not null default now(),
  -- Bumped on every launch, so a phone that stopped checking in is visible.
  last_seen_at timestamptz not null default now(),
  -- Set when Apple tells us the token is dead (410 Unregistered). Kept
  -- rather than deleted: knowing a device stopped accepting notifications is
  -- worth more than a tidy table, and re-registering simply clears it.
  disabled_at timestamptz,
  disabled_reason text
);

create index if not exists device_tokens_live_idx
  on device_tokens (disabled_at, last_seen_at desc);

notify pgrst, 'reload schema';
