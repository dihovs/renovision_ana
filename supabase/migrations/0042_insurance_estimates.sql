-- Renovision AnA — the insurance estimate: measurements to money.
--
-- A separate document from quotes, deliberately. A consumer quote taxes its
-- subtotal with no overhead trailer and prices one rate per line; an
-- insurance estimate carries the industry's whole line model — a removal
-- rate AND a replacement rate on one E&R line, per-line overhead & profit,
-- taxes computed on top of both, a room/trade print structure, and a merge
-- contract between machine-derived and hand-written lines. Cramming that
-- into quote_line_items would distort the quoting path for every consumer
-- job. The two documents share the price book and nothing else.
-- Conventions extracted from four real Xactimate claims:
-- Docs/Estimator-Xactimate-Conventions.md.

create table if not exists public.insurance_estimates (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  project_id uuid not null references public.projects(id) on delete cascade,

  -- draft is editable and re-derivable; final freezes the document the way
  -- a sent quote freezes. One draft per project at a time keeps "the
  -- estimate" a definite article; finals accumulate as versions.
  status text not null default 'draft' check (status in ('draft', 'final')),
  title  text not null default 'Estimate',

  -- The O&P trailer settings, in basis points so they are integers.
  -- Polygon's convention is the default: 10% generals, 5% profit computed
  -- on items + generals. Restauration CT computes profit on items alone —
  -- the basis is a firm convention, not a constant, so it is a column.
  generals_bp   integer not null default 1000,
  profit_bp     integer not null default 500,
  profit_basis  text not null default 'items_plus_generals'
    check (profit_basis in ('items_plus_generals', 'items')),

  notes text
);

create unique index if not exists insurance_estimates_one_draft
  on public.insurance_estimates (project_id)
  where status = 'draft';

create index if not exists insurance_estimates_project_idx
  on public.insurance_estimates (project_id, created_at desc);

create table if not exists public.insurance_estimate_lines (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  estimate_id uuid not null references public.insurance_estimates(id) on delete cascade,
  position    integer not null default 0,

  -- The merge contract (Estimator-Spec.md §3.1). `key` is the line's stable
  -- identity across re-derivations; `origin` says whether the next
  -- derivation may replace it; `provenance` records which door it came in
  -- through — rule, accepted AI suggestion, or the operator's own hand.
  key        text not null,
  origin     text not null default 'derived' check (origin in ('derived', 'manual')),
  provenance text not null default 'rule' check (provenance in ('rule', 'ai', 'operator')),

  -- Where the line prints. Null room = the "Frais généraux" pseudo-room.
  room_scan_id uuid references public.room_scans(id) on delete set null,
  room_name    text not null default '',
  trade_section text not null default 'misc',

  -- The Xactimate line model: an activity, up to two price book codes, and
  -- up to two rates. Rates are COPIED cents, frozen at write time exactly
  -- like quote lines copy the price book — later book edits change future
  -- estimates, not this one. Null rate = visibly unpriced, never zero.
  activity  text not null default 'install'
    check (activity in ('install', 'remove', 'replace', 'detachReset', 'memo')),
  item_code         text,
  removal_item_code text,
  name     text not null,
  unit     text not null default 'each',
  -- Two-decimal quantities, stored ×100 as an integer for exact arithmetic.
  quantity_hundredths integer not null default 100,
  remove_rate_cents   integer,
  replace_rate_cents  integer,

  -- The measurement citation — which figure this quantity came from. The
  -- adjuster's first question about any number, answered on the line.
  calc  text not null default '',
  note  text,
  -- 'no_item' | 'unknown_finish' markers, comma-separated. A visible gap
  -- gets filled; a plausible invention gets sent to an insurer.
  issues text not null default '',
  taxable bool not null default true,
  -- The tombstone: an operator-deleted derived line. Kept so re-derivation
  -- cannot resurrect it; printed nowhere; totals skip it.
  removed bool not null default false
);

create index if not exists insurance_estimate_lines_estimate_idx
  on public.insurance_estimate_lines (estimate_id, position);

-- One estimate cannot hold two lines with the same identity — the merge
-- contract depends on it.
create unique index if not exists insurance_estimate_lines_key_idx
  on public.insurance_estimate_lines (estimate_id, key);

-- What the floor is finished with, per room. The estimator's floor rules
-- cannot choose removal and install items without it, and guessing a finish
-- prices work nobody scoped — so it is recorded where the room lives and
-- the estimate reads it like every other measurement.
alter table public.room_scans add column if not exists floor_finish text
  check (floor_finish in ('laminate', 'lvp', 'engineered', 'hardwood', 'carpet', 'tile'));

alter table public.insurance_estimates enable row level security;
alter table public.insurance_estimate_lines enable row level security;
grant all on public.insurance_estimates to service_role;
grant all on public.insurance_estimate_lines to service_role;

drop trigger if exists insurance_estimates_touch on public.insurance_estimates;
create trigger insurance_estimates_touch
  before update on public.insurance_estimates
  for each row execute function public.touch_updated_at();

drop trigger if exists insurance_estimate_lines_touch on public.insurance_estimate_lines;
create trigger insurance_estimate_lines_touch
  before update on public.insurance_estimate_lines
  for each row execute function public.touch_updated_at();
