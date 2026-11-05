-- The team. (Field-service spine, step 6)
--
-- Until now there was no staff table, on purpose (0012, 0035): one owner, and
-- crew reached as WhatsApp contacts with a per-job link. That stops working
-- the moment there are two crews — "who is on Tuesday's visit", "who worked
-- how many hours", "who may see prices" all need a row per worker.
--
-- A team member is NOT a login. The admin still has one password; crew still
-- open their job link. This row is who they are, what role they hold and
-- which WhatsApp contact reaches them, so visits can be assigned to them and
-- time clocked against them. Per-person logins can hang off it later.
--
-- WHY IT POINTS AT people AND whatsapp_contacts
--
-- `people` (0046) is the one-human-however-they-reach-us table, so a worker is
-- a person first. `whatsapp_contacts` is what dispatch actually sends to
-- (0044), so the link is kept directly: assigning a visit can then notify
-- exactly the assigned crew without a second lookup. Both nullable — a worker
-- added by name before anyone has their number is still a worker.

create table if not exists public.team_members (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  display_name text not null check (length(trim(display_name)) > 0),

  -- owner: everything. manager: everything but settings and money out.
  -- crew: their visits, their checklist, their clock — never prices.
  role text not null default 'crew' check (role in ('owner','manager','crew')),

  -- Overrides on top of the role's defaults (src/lib/crm/team.ts
  -- ROLE_PERMISSIONS). Empty means "the role's defaults".
  permissions jsonb not null default '{}'::jsonb,

  phone text,
  person_id uuid references public.people (id) on delete set null,
  whatsapp_contact_id uuid references public.whatsapp_contacts (id) on delete set null,

  -- Two letters for the visit card when the name is ambiguous ("JM", "JR").
  initials text check (initials is null or length(initials) between 1 and 3),

  -- Inactive members keep their history (hours, visits) and drop out of
  -- pickers. Never deleted: a timesheet that loses its worker is worthless.
  active boolean not null default true
);

create index if not exists team_members_active_idx on public.team_members (active, display_name);
create unique index if not exists team_members_whatsapp_idx
  on public.team_members (whatsapp_contact_id) where whatsapp_contact_id is not null;

drop trigger if exists team_members_touch_updated_at on public.team_members;
create trigger team_members_touch_updated_at
  before update on public.team_members
  for each row execute function public.touch_updated_at();

alter table public.team_members enable row level security;
grant all on public.team_members to service_role;

notify pgrst, 'reload schema';
