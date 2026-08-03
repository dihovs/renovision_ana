-- Renovision AnA — crew links.
--
-- One opaque, revocable link per JOB, handed to whoever is doing the work:
-- employee, subcontractor, the guy with the truck. It opens a page that shows
-- the tasks, the address, the access notes, the arrival window and the photos
-- — and not one number about money.
--
-- WHY A TABLE AND NOT A COLUMN ON jobs
--
-- The client hub put its token on `clients` (0008), and that was right there:
-- one durable link per customer, and `clients` is read through narrow selects.
-- `jobs` is different. `getJob` reads `select("*")` and hands the whole row to
-- the admin UI, the assistant and anything else downstream — a `crew_token`
-- column would ride along in every one of those payloads forever. A separate
-- table means the secret is only ever read by the one module that needs it.
--
-- WHY PER-JOB AND NOT PER-CREW
--
-- A crew link is a key to one address on one day. A subcontractor who did a
-- bathroom in March should not still be able to see where we are working in
-- November, and the person most likely to forward the link is the person we
-- gave it to. Scoping it to the job makes the blast radius one job.

create table if not exists public.job_crew_tokens (
  -- The primary key IS the job: one live link per job, so re-minting is an
  -- upsert and there is no way to accumulate a drawer full of valid keys.
  job_id uuid primary key references public.jobs (id) on delete cascade,

  -- 32 random bytes, hex. The credential itself — there is no session and no
  -- password behind this page, so it is treated like one: unique, opaque, and
  -- never derived from the job id.
  token text not null unique,

  created_at timestamptz not null default now(),

  -- Hard ceiling, set at mint time. A crew link is not a bookmark; the useful
  -- life of one is measured in weeks, and a link with no expiry is a key that
  -- stays under the mat forever. The application also stops honouring a link
  -- some days after the job is marked complete — that grace period is computed
  -- from jobs.completed_at at read time rather than written here, so marking a
  -- job done actually shortens the link instead of leaving this row stale.
  expires_at timestamptz not null,

  -- "Did they ever open it" — answerable without digging through server logs,
  -- which are neither queryable nor kept. Same reasoning as hub_last_viewed_at.
  last_viewed_at timestamptz
);

-- The lookup that every page load performs.
create index if not exists job_crew_tokens_token_idx on public.job_crew_tokens (token);

alter table public.job_crew_tokens enable row level security;

-- RLS is on with no policies, so anon and authenticated are refused outright.
-- service_role bypasses RLS but not table grants, hence the explicit grant.
grant all on public.job_crew_tokens to service_role;
