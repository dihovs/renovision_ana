-- The Microsoft connection: one account, one row. (ANA-04)
--
-- Teams, Outlook and OneDrive are one integration, not three. They are all
-- Microsoft Graph, so one app registration, one consent, one token — and this
-- one table, which every later reader (ANA-05 Teams, ANA-06 Outlook, ANA-07
-- OneDrive) goes through rather than each holding its own credential.
--
-- DELEGATED, NOT APPLICATION. The token here is the owner's own — Ana sees what
-- he sees, and nothing else in the tenant. Application permissions would have
-- been simpler to keep alive (no refresh, no expiry) and would have handed a
-- background service standing access to every mailbox in the company. He asked
-- for his Teams, his mail, his files, and delegated access is that sentence
-- expressed as a grant.
--
-- WHAT IS DELIBERATELY NOT HERE: any call or meeting scope. The owner was
-- explicit on 30 Aug 2026 that Ana reads Teams *messages* and not Teams calls,
-- and the way that is honoured is by never asking Microsoft for it — see
-- GRAPH_SCOPES in src/lib/microsoft/scopes.ts. The consent screen is the
-- enforcement point, not a sentence in a prompt.
--
-- ONE ROW. `singleton` is a generated constant with a unique index on it, so a
-- second connection cannot be inserted — re-consenting updates the row. Two
-- rows would mean two answers to "whose mail are we reading", and the code
-- would have to pick one.

create table if not exists public.microsoft_tokens (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Who consented, for the admin to read back. Not used to authenticate
  -- anything — the token is the credential; this is the label on it.
  account_upn  text,
  account_name text,
  tenant_id    text,

  -- What Microsoft actually granted, which is not always what was asked for:
  -- an admin can restrict scopes, and a silently narrower grant would show up
  -- later as an empty mailbox rather than an error. Stored so the health check
  -- can say what is really held.
  granted_scopes text[] not null default '{}',

  -- ENCRYPTED AT REST, both of them. A refresh token is a standing key to the
  -- owner's mail and files that survives password changes, so it is the last
  -- thing that should sit in plaintext in a table. AES-256-GCM, key in
  -- MICROSOFT_TOKEN_KEY, format described in src/lib/microsoft/tokens.ts.
  -- RLS and the service_role grant below already keep this table off the API,
  -- but a database backup, a support session or a future misconfigured policy
  -- are all ways a row is read by someone who should not have it, and none of
  -- them are stopped by RLS.
  access_token_enc  text,
  access_expires_at timestamptz,
  refresh_token_enc text,

  -- Set when a refresh is refused — consent revoked, password changed, the app
  -- removed. Kept rather than deleting the row so the admin can say "the
  -- Microsoft connection stopped working on the 4th" instead of showing nothing
  -- and implying it was never set up.
  invalidated_at     timestamptz,
  invalidated_reason text,

  singleton boolean generated always as (true) stored
);

create unique index if not exists microsoft_tokens_one_row
  on public.microsoft_tokens (singleton);

drop trigger if exists microsoft_tokens_touch_updated_at on public.microsoft_tokens;
create trigger microsoft_tokens_touch_updated_at
  before update on public.microsoft_tokens
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Access
-- ---------------------------------------------------------------------------
--
-- Both halves, for the reasons 0040 and 0046 record. RLS on with no policies:
-- this table holds a credential and nothing outside the server has business in
-- it. And the grant written out, because a table created by hand in the SQL
-- editor is created by a role whose default privileges exclude the API roles,
-- and that failure is silent — reads come back empty rather than erroring, so
-- the app would report "Microsoft is not connected" when it is.

alter table public.microsoft_tokens enable row level security;

grant select, insert, update, delete on table public.microsoft_tokens to service_role;

notify pgrst, 'reload schema';
