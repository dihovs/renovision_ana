-- Checklist templates, attached per job or per visit, filled in as
-- submissions. (Field-service spine, step 9)
--
-- 0014 gave a job one flat list of tick boxes, and per-visit lists were ruled
-- out then. What the site actually needs is a FORM: "moisture reading in the
-- kitchen wall (number)", "dehumidifier running (yes/no)", "customer signs
-- off (signature)", "photo of the meter". Built once as a template, used on
-- every job of that kind, and — for a drying job — a different one on the
-- first visit (set up) than on the last (pick up).
--
-- The flat list stays. These sit beside it.
--
-- SECTIONS ARE JSON, AND ATTACHING COPIES THEM
--
-- A template is a document (sections, each holding typed fields) that is
-- edited as a whole and read as a whole; a table per field would make every
-- save a diff. Attaching a template to a job copies its sections into the
-- job's checklist, so editing the template next month does not rewrite what
-- a crew filled in last week. The shape is validated in the app
-- (src/lib/crm/checklistTypes.ts), not here.
--
-- A SUBMISSION IS SAVED ONCE, HOWEVER OFTEN THE PHONE RETRIES
--
-- The crew page queues a submit that fails for lack of signal and retries it
-- later, possibly several times. Each submit carries an id the phone made
-- (client_submission_id); the unique index turns a retry of something that
-- did arrive into a no-op instead of a duplicate.

create table if not exists public.checklist_templates (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  name        text not null check (length(trim(name)) > 0),
  description text,
  sections    jsonb not null default '[]'::jsonb,
  archived_at timestamptz
);

drop trigger if exists checklist_templates_touch_updated_at on public.checklist_templates;
create trigger checklist_templates_touch_updated_at
  before update on public.checklist_templates
  for each row execute function public.touch_updated_at();

create table if not exists public.job_checklists (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  job_id   uuid not null references public.jobs (id) on delete cascade,
  -- Null = the whole job (shown on every visit). Set = that visit only.
  visit_id uuid references public.visits (id) on delete cascade,
  template_id uuid references public.checklist_templates (id) on delete set null,

  -- The copy: what the crew sees, frozen at attach time.
  name     text not null,
  sections jsonb not null default '[]'::jsonb,
  position integer not null default 0
);

create index if not exists job_checklists_job_idx on public.job_checklists (job_id, position);

drop trigger if exists job_checklists_touch_updated_at on public.job_checklists;
create trigger job_checklists_touch_updated_at
  before update on public.job_checklists
  for each row execute function public.touch_updated_at();

create table if not exists public.checklist_submissions (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  job_checklist_id uuid not null references public.job_checklists (id) on delete cascade,
  visit_id         uuid references public.visits (id) on delete set null,
  team_member_id   uuid references public.team_members (id) on delete set null,
  submitted_by     text,

  -- { fieldId: value }. Signatures and photos are small JPEG/PNG data URLs,
  -- shrunk on the phone before they are sent.
  "values" jsonb not null default '{}'::jsonb,

  client_submission_id text not null,
  -- When the crew pressed Submit — which, for a queued submit, can be well
  -- before created_at.
  submitted_at timestamptz not null default now()
);

create unique index if not exists checklist_submissions_once_idx
  on public.checklist_submissions (client_submission_id);
create index if not exists checklist_submissions_checklist_idx
  on public.checklist_submissions (job_checklist_id, submitted_at desc);

alter table public.checklist_templates enable row level security;
alter table public.job_checklists enable row level security;
alter table public.checklist_submissions enable row level security;
grant all on public.checklist_templates to service_role;
grant all on public.job_checklists to service_role;
grant all on public.checklist_submissions to service_role;

notify pgrst, 'reload schema';
