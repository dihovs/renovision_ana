-- Renovision AnA — Get Shareable Link.
--
-- A view-only web link to a project's report, the way magicplan's Export
-- sheet offers one. The owner's call (9 Nov 2026, "you decide"): the link
-- shows the plans, measurements, damage and photos — never prices, the
-- client's name or contact details, or claim and policy numbers. Anyone
-- holding the link can open it; it lapses after 30 days and can be revoked.
--
-- The token is the credential, as with clients.hub_token and the quote
-- links: 32 random bytes, base64url, unguessable and never derived from ids.

create table if not exists public.project_share_links (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  token text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);

create index if not exists project_share_links_project_idx
  on public.project_share_links (project_id, created_at desc);

alter table public.project_share_links enable row level security;
grant all on public.project_share_links to service_role;

notify pgrst, 'reload schema';
