-- Client hub — one durable link per client.
--
-- A quote link and an invoice link are per-document and short-lived by nature.
-- The hub is different: it is the address a repeat customer bookmarks, or that
-- a property manager forwards to their own accounts department. So the token
-- lives on the client rather than being minted per visit.
--
-- Nullable and minted on demand: a client who has never been given a link has
-- no token to leak, and one that gets forwarded somewhere it shouldn't can be
-- revoked by setting this back to null without touching anything else.

alter table public.clients
  add column if not exists hub_token text unique,
  -- Recorded so "did they ever open it" is answerable without guessing from
  -- server logs, which are neither queryable nor kept.
  add column if not exists hub_last_viewed_at timestamptz;

create index if not exists clients_hub_token_idx on public.clients (hub_token);
