-- Quotes can belong to a project — the container an estimate is actually
-- built under, when the work is bigger than one quote. SET NULL rather than
-- CASCADE: archiving or deleting a project must not delete the financial
-- record of a quote that was built inside it — the quote just becomes
-- unaffiliated, same as a lead being deleted under a client (see 0001).
alter table public.quotes
  add column if not exists project_id uuid references public.projects (id) on delete set null;

create index if not exists quotes_project_idx
  on public.quotes (project_id) where project_id is not null;

-- Good/Better/Best: a line can belong to a named tier. Nullable and
-- additive on purpose — every existing quote has tier = null on every line,
-- so it keeps behaving exactly as it does today (a flat list of always-in
-- lines plus individually-tickable optional ones). Only a quote where the
-- operator deliberately assigns tiers gets the tier picker instead.
alter table public.quote_line_items
  add column if not exists tier text check (tier in ('good', 'better', 'best'));

-- A tiered line must also be optional: the tier choice IS how it gets
-- included, so "in a tier but never optional" is a contradiction the
-- database should refuse to store rather than silently allow.
alter table public.quote_line_items
  drop constraint if exists quote_line_tier_requires_optional;
alter table public.quote_line_items
  add constraint quote_line_tier_requires_optional check (tier is null or optional);
