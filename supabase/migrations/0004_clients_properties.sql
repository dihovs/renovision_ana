-- Renovision AnA — clients, properties, and configurable settings.
--
-- WHY CLIENT AND PROPERTY ARE SEPARATE TABLES
--
-- The obvious shortcut is one "customer" row with an address on it. That works
-- until the first property manager: Gestion Ajax is one client who pays the
-- bills, with many buildings, each at a different address. Collapsing the two
-- means either duplicating the client per building (and losing "show me
-- everything for Ajax") or losing the address the crew actually drives to.
--
-- Jobber models these as separate objects for the same reason. Splitting them
-- later means rewriting every quote, job, and invoice that points at the wrong
-- one, so it is done up front.
--
--   client   → who is billed. Holds the billing address.
--   property → where the work happens. Holds the service address.
--
-- A residential client normally has exactly one property that mirrors the
-- billing address; the form fills that in automatically so the common case
-- costs nothing.

-- ---------------------------------------------------------------------------
-- Settings — the "plug and unplug things" surface.
-- ---------------------------------------------------------------------------
--
-- Key/value rather than a column per option, because the whole point is that
-- new options can be added from the UI without a migration. Each key holds one
-- JSON document; the shape is validated in TypeScript, not here, so that
-- adding a field to a definition is a code change rather than a schema change.

create table if not exists public.app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

-- Tax rates as GROUPS of named components, not one percentage.
--
-- Quebec charges GST 5% and QST 9.975%, and both must appear as separate lines
-- on the invoice — a single 14.975% line is not a compliant document. Each is
-- calculated on the pre-tax subtotal (Quebec de-harmonised in 2013; QST is not
-- charged on GST), so the components sum rather than compound.
--
-- Rates are stored in basis points as integers. 9.975% is 997.5 bps, so the
-- unit is hundredths of a basis point — 99750 — to keep every rate an exact
-- integer. Floating-point rates are how tax totals end up a cent out.
insert into public.app_settings (key, value)
values (
  'tax_rates',
  '{
     "default": "qc",
     "rates": [
       {
         "id": "qc",
         "label": "GST + QST (Quebec)",
         "components": [
           { "name": "GST",  "rate": 50000,  "registration": "" },
           { "name": "QST",  "rate": 99750,  "registration": "" }
         ]
       },
       {
         "id": "exempt",
         "label": "No tax",
         "components": []
       }
     ]
   }'::jsonb
)
on conflict (key) do nothing;

-- Where leads come from. A list rather than a check constraint so it can be
-- edited from the settings screen without a migration.
insert into public.app_settings (key, value)
values (
  'lead_sources',
  '["Website", "Google", "Referral", "Repeat client", "Facebook", "Instagram", "Phone", "Insurance", "Other"]'::jsonb
)
on conflict (key) do nothing;

-- Custom fields, per object type. Empty until the owner adds some.
-- Each entry: { id, label, type: "text"|"number"|"date"|"checkbox"|"select",
--               options?: string[], showOnQuote: boolean }
insert into public.app_settings (key, value)
values (
  'custom_fields',
  '{ "client": [], "property": [], "quote": [] }'::jsonb
)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Clients
-- ---------------------------------------------------------------------------

create table if not exists public.clients (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- All three are optional individually, but at least one must be present —
  -- see the check below. A commercial client often has only a company name;
  -- a residential one often has only a person's name.
  first_name   text,
  last_name    text,
  company_name text,

  -- Contacts as JSON arrays rather than child tables.
  --
  -- Jobber uses separate contact records, which is right for a multi-user
  -- product with per-contact notification settings. Here it would mean
  -- diffing child rows on every form save for a single operator who will
  -- rarely enter more than two of each. The structure is preserved:
  --   emails: [{ address, type, primary, receivesQuotes, receivesInvoices }]
  --   phones: [{ number, type, primary, smsAllowed }]
  -- type is one of main/work/home/mobile/fax/other.
  emails       jsonb not null default '[]'::jsonb,
  phones       jsonb not null default '[]'::jsonb,

  -- Billing address. Where invoices go, which is not always where work happens.
  billing_street1     text,
  billing_street2     text,
  billing_city        text,
  billing_province    text default 'QC',
  billing_postal_code text,
  billing_country     text default 'Canada',

  -- Defaults inherited by this client's quotes and invoices. Null means "use
  -- the account default" rather than "no tax" — the distinction matters when
  -- the account default later changes.
  tax_rate_id  text,

  lead_source  text,
  -- Free-form labels. Kept as an array so filtering by one is an index away.
  tags         text[] not null default '{}',

  notes        text,
  custom       jsonb not null default '{}'::jsonb,

  -- Archived rather than deleted: a client attached to a paid invoice must
  -- stay readable for tax purposes even after they stop being a customer.
  archived_at  timestamptz,

  constraint clients_have_a_name check (
    coalesce(nullif(trim(first_name), ''), nullif(trim(last_name), ''), nullif(trim(company_name), '')) is not null
  )
);

-- The list view is "recently touched first"; archived rows are filtered out.
create index if not exists clients_updated_at_idx on public.clients (updated_at desc);
create index if not exists clients_archived_idx   on public.clients (archived_at);
create index if not exists clients_tags_idx       on public.clients using gin (tags);

-- Name search. Matching "ajax" against a company name and "tremblay" against a
-- surname is the same query from the operator's point of view, so it is one
-- index over the concatenation rather than three separate lookups.
create index if not exists clients_name_search_idx on public.clients
  using gin (to_tsvector('simple',
    coalesce(first_name, '') || ' ' || coalesce(last_name, '') || ' ' || coalesce(company_name, '')));

alter table public.clients enable row level security;

-- ---------------------------------------------------------------------------
-- Properties
-- ---------------------------------------------------------------------------

create table if not exists public.properties (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- Cascade: a property has no meaning without its client. Deleting a client
  -- is already guarded by archiving, so this only fires on a real purge.
  client_id   uuid not null references public.clients (id) on delete cascade,

  street1     text,
  street2     text,
  city        text,
  province    text default 'QC',
  postal_code text,
  country     text default 'Canada',

  -- From Google Places. place_id is stored so the same address entered twice
  -- can be recognised as one place despite different formatting, and so the
  -- coordinates can be refreshed later without re-geocoding from text.
  google_place_id text,
  latitude        numeric(10, 7),
  longitude       numeric(10, 7),

  -- Per-property tax override. A property in Ontario is charged HST even
  -- though the client is billed in Quebec — tax follows the place of supply,
  -- not the billing address. Null means "inherit from the client".
  tax_rate_id text,

  -- Operational detail the crew needs on arrival, not billing detail.
  -- Kept on the property because it belongs to the building, not the person.
  access_notes text,

  notes       text,
  custom      jsonb not null default '{}'::jsonb,
  archived_at timestamptz
);

create index if not exists properties_client_idx  on public.properties (client_id);
create index if not exists properties_archived_idx on public.properties (archived_at);

alter table public.properties enable row level security;

-- ---------------------------------------------------------------------------
-- Link leads to clients
-- ---------------------------------------------------------------------------
--
-- A lead becomes a client when it is worth tracking beyond the enquiry. The
-- lead row is kept either way: it is the record of what the customer actually
-- asked for, in their words, and the estimator's original numbers. Overwriting
-- that with the tidied-up client record loses the evidence.
--
-- ON DELETE SET NULL, not cascade — purging a client must never silently
-- delete the enquiries that led to them.

alter table public.leads
  add column if not exists client_id   uuid references public.clients (id) on delete set null,
  add column if not exists property_id uuid references public.properties (id) on delete set null;

create index if not exists leads_client_idx on public.leads (client_id);

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
--
-- RLS is enabled with no policies on all three tables, so anon and
-- authenticated are denied regardless. service_role bypasses RLS but NOT table
-- grants, which is what caused "permission denied for table leads" earlier —
-- granting explicitly is stricter than switching auto-exposure back on,
-- because it names the one role that should have access.

grant all on public.clients      to service_role;
grant all on public.properties   to service_role;
grant all on public.app_settings to service_role;

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
--
-- Set in the database rather than by the application. An update that forgets
-- to touch the column is invisible until the list is sorted wrong weeks later.

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists clients_touch_updated_at on public.clients;
create trigger clients_touch_updated_at
  before update on public.clients
  for each row execute function public.touch_updated_at();

drop trigger if exists properties_touch_updated_at on public.properties;
create trigger properties_touch_updated_at
  before update on public.properties
  for each row execute function public.touch_updated_at();

drop trigger if exists app_settings_touch_updated_at on public.app_settings;
create trigger app_settings_touch_updated_at
  before update on public.app_settings
  for each row execute function public.touch_updated_at();
