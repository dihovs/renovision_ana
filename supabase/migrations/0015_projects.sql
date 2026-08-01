-- Renovision AnA — projects and their file library.
--
-- A project is the container ABOVE jobs: "Dubois basement renovation" can span
-- an assessment job, a demolition job and a finishing job, and it accumulates
-- paperwork the whole way — site photos, permits, contracts, supplier
-- receipts, plans. The file library is the point of this table: one folder per
-- project where everything about the work lives, instead of a phone camera
-- roll, a glovebox and three email threads.
--
-- Deliberately light. No numbering sequence and no money columns: a project is
-- a working folder, not a financial document. The financial records stay on
-- quotes, jobs and invoices, which projects merely group.

-- ---------------------------------------------------------------------------
-- Projects
-- ---------------------------------------------------------------------------

create table if not exists public.projects (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  name text not null,

  -- SET NULL rather than RESTRICT: unlike a job or an invoice, a project is
  -- not a record an auditor needs, so it should survive a client purge
  -- without blocking it.
  client_id uuid references public.clients (id) on delete set null,

  -- active   — being worked
  -- on_hold  — paused: permits, customer decisions, weather
  -- done     — finished
  -- archived — out of the way
  status text not null default 'active'
         check (status in ('active','on_hold','done','archived')),

  description text,
  started_on  date,

  -- Kept alongside the 'archived' status so "when was it put away" survives a
  -- later status correction, same as jobs and clients.
  archived_at timestamptz
);

create index if not exists projects_client_idx  on public.projects (client_id);
create index if not exists projects_status_idx  on public.projects (status);
create index if not exists projects_updated_idx on public.projects (updated_at desc);

alter table public.projects enable row level security;

-- ---------------------------------------------------------------------------
-- Files
-- ---------------------------------------------------------------------------
--
-- Same principle as lead photos (0002): the bytes live in Supabase Storage,
-- the table stores paths and display metadata only. A contract PDF in a text
-- column would inflate every row and count against the database limit.

create table if not exists public.project_files (
  id uuid primary key default gen_random_uuid(),

  -- CASCADE: the file rows are only meaningful inside their project. The
  -- storage objects are removed by application code; a deleted project's
  -- orphaned objects are invisible and harmless, a row without its project
  -- is neither.
  project_id uuid not null references public.projects (id) on delete cascade,

  -- Path inside the project-files bucket, not a URL. Signed URLs are minted
  -- per request and would outlive their own expiry if stored.
  storage_path text not null,

  -- The sanitized original name, kept for display; the storage path carries a
  -- uuid so two "IMG_0001.jpg" uploads never collide.
  filename text not null,

  -- Measured server-side from the bytes actually received — the browser's
  -- claim is never written here.
  size_bytes   integer not null default 0,
  content_type text not null default 'application/octet-stream',

  -- "signed permit", "receipt for the vanity" — what a filename can't say.
  note text,

  uploaded_at timestamptz not null default now()
);

create index if not exists project_files_project_idx
  on public.project_files (project_id, uploaded_at desc);

alter table public.project_files enable row level security;

-- ---------------------------------------------------------------------------
-- Jobs attached to a project
-- ---------------------------------------------------------------------------
--
-- A link table rather than a project_id column on jobs: jobs are a finished,
-- audited surface and this feature must not touch their schema. The pair is
-- the primary key, so attaching twice is impossible by construction.

create table if not exists public.project_jobs (
  project_id  uuid not null references public.projects (id) on delete cascade,
  job_id      uuid not null references public.jobs (id) on delete cascade,
  attached_at timestamptz not null default now(),
  primary key (project_id, job_id)
);

create index if not exists project_jobs_job_idx on public.project_jobs (job_id);

alter table public.project_jobs enable row level security;

-- ---------------------------------------------------------------------------
-- Storage bucket
-- ---------------------------------------------------------------------------
--
-- PRIVATE, same reasoning as lead-photos (0002): these are photographs of the
-- inside of customers' homes, signed contracts and permits. They are only ever
-- served through short-lived signed URLs generated for the signed-in operator;
-- there is no public URL for any of them.

insert into storage.buckets (id, name, public)
values ('project-files', 'project-files', false)
on conflict (id) do update set public = false;

-- The service_role grant on storage.objects already exists from 0002, but
-- grants are idempotent and repeating it keeps this migration standalone.
grant select, insert, update, delete on storage.objects to service_role;

-- Storage enforces RLS on storage.objects, so without a policy even a granted
-- role is refused — and no policy exists for anon/authenticated by design.
drop policy if exists "service role manages project files" on storage.objects;
create policy "service role manages project files"
  on storage.objects
  for all
  to service_role
  using (bucket_id = 'project-files')
  with check (bucket_id = 'project-files');

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
--
-- "Automatically expose new tables" is off, so the server role needs explicit
-- grants. anon and authenticated get nothing, which is what keeps the tables
-- private.

grant all on public.projects      to service_role;
grant all on public.project_files to service_role;
grant all on public.project_jobs  to service_role;

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------

drop trigger if exists projects_touch_updated_at on public.projects;
create trigger projects_touch_updated_at before update on public.projects
  for each row execute function public.touch_updated_at();
