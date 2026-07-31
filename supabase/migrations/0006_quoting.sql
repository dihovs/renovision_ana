-- Renovision AnA — the price book, quotes, and quote line items.
--
-- This is the financial core. Three principles run through it, and every
-- column below follows from one of them:
--
--   1. MONEY IS INTEGER CENTS. Never a float, never a formatted string. The
--      leads table stores totals as text (0001, lines 36-44) because it was
--      recording what a chat widget had already printed. That is the
--      anti-pattern here, not the precedent.
--
--   2. A SENT DOCUMENT IS FROZEN. A quote is an offer. What the customer was
--      shown must still render identically in two years, after the client
--      moved, the tax rate changed, and the price book was repriced. That is
--      what the *_snapshot columns are for, and skipping them is the single
--      most expensive mistake available in this schema.
--
--   3. QUEBEC LAW IS SCHEMA, NOT DECORATION. The RBQ licence number on a
--      quote, the French-first rule, and the itinerant-merchant regime each
--      have real columns because each has real consequences — a missing
--      element turns a 10-day cancellation window into a one-year one
--      (CPA s. 59).

-- ---------------------------------------------------------------------------
-- Company identity — the legal header on every document
-- ---------------------------------------------------------------------------
--
-- Stored as a setting rather than hardcoded so the owner can fill it in from
-- the Settings screen without a deploy. Every field here appears on a document
-- or gates one.
--
-- On tax_registered: registration is only MANDATORY once worldwide taxable
-- supplies exceed $30,000 in a calendar quarter or the four preceding quarters
-- (Revenu Québec, "Registering for the GST and the QST"). Below that threshold
-- a small supplier "is not required to collect the taxes" — and must not.
-- So this is a hard gate: false means the document renderer suppresses the tax
-- lines entirely. Charging tax you are not registered to collect is not a
-- rounding error, it is collecting money you have no right to.

insert into public.app_settings (key, value)
values (
  'company',
  '{
     "legalName": "",
     "tradeName": "Renovision AnA",
     "street1": "", "street2": "", "city": "Laval",
     "province": "QC", "postalCode": "", "country": "Canada",
     "phone": "", "email": "", "website": "",
     "rbqLicence": "",
     "neq": "",
     "taxRegistered": false,
     "gstNumber": "",
     "qstNumber": "",
     "opcPermit": ""
   }'::jsonb
)
on conflict (key) do nothing;

-- Document defaults. Wording lives here so it is edited once, not retyped per
-- quote. French is the source text: under CPA s. 26, where a French and a
-- non-French version diverge, "l'interprétation la plus favorable au
-- consommateur prévaut" — so the two must never say different things, and the
-- way to guarantee that is one authoritative original.
insert into public.app_settings (key, value)
values (
  'quote_defaults',
  '{
     "validDays": 30,
     "depositKind": "none",
     "depositValue": 0,
     "requireSignature": false,
     "showQuantities": true,
     "showUnitPrices": true,
     "showLineTotals": true,
     "showTotalsFooter": true,
     "clientMessageFr": "",
     "clientMessageEn": "",
     "contractTermsFr": "",
     "contractTermsEn": ""
   }'::jsonb
)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Price book — saved line items
-- ---------------------------------------------------------------------------
--
-- Seeded from the 128-item estimator catalog, but a SEPARATE store, not a view
-- over it. The estimator catalog is a static TypeScript array compiled into the
-- public site bundle; the price book is editable, holds internal cost, and must
-- never ship to a browser. Same origin, different lifetimes.
--
-- Adding an item to a quote COPIES its values onto the quote line. Later edits
-- here never reach documents already written — repricing next spring must not
-- silently rewrite a quote sent last autumn.

create table if not exists public.price_book_items (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- Stable code carried over from the estimator catalog (FLR-LAM-INST etc.),
  -- so a seeded item can be re-matched on a later re-import. Nullable because
  -- items added by hand in the UI have no catalog ancestry.
  item_code   text unique,

  name        text not null,
  description text,
  category    text,
  subcategory text,

  -- "sq ft", "linear ft", "each", "hour". Free text on purpose: the estimator's
  -- Unit union is declared but not enforced on its own data (types.ts), so a
  -- CHECK here would reject rows the seed itself produces.
  unit        text,

  -- What it costs us, and what we charge. Cost is NULLABLE and starts null:
  -- the public repo's catalog carries only a sell rate — internal cost and
  -- margin were deliberately stripped from it — so there is nothing truthful
  -- to seed. A guessed cost is worse than an absent one, because it produces a
  -- confident margin figure that is wrong.
  unit_cost_cents  integer,
  unit_price_cents integer not null default 0,

  -- Labour content, carried from the estimator. Owner-side only; never printed
  -- on a customer document.
  labor_hours_per_unit numeric,
  labor_class          text,

  -- Default only. The quote line owns the real answer, because the same work
  -- can be taxable for one customer and not another.
  taxable     boolean not null default true,

  -- Extra search terms so "laminate" finds FLR-LAM-INST. Kept out of
  -- description deliberately: keywords are for finding, description is for
  -- printing, and merging them puts search noise on a customer's quote.
  keywords    text,
  -- Scope caveats from the catalog ("excludes subfloor repair"). These ARE
  -- customer-facing and seed the line description.
  exclusions  text,

  archived_at timestamptz
);

create index if not exists price_book_active_idx   on public.price_book_items (archived_at);
create index if not exists price_book_category_idx on public.price_book_items (category);
create index if not exists price_book_search_idx   on public.price_book_items
  using gin (to_tsvector('simple',
    coalesce(name, '') || ' ' || coalesce(keywords, '') || ' ' || coalesce(item_code, '')));

alter table public.price_book_items enable row level security;

-- ---------------------------------------------------------------------------
-- Quote numbering
-- ---------------------------------------------------------------------------
--
-- A Postgres sequence, not a counter in app_settings. The settings table is
-- read-then-upsert, which is not concurrency-safe: a double-submitted form
-- would issue the same number twice, and two documents sharing a number is the
-- kind of defect you discover during an audit. nextval() is atomic.

create sequence if not exists public.quote_number_seq start 1000;

-- ---------------------------------------------------------------------------
-- Quotes
-- ---------------------------------------------------------------------------

create table if not exists public.quotes (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  quote_number integer not null default nextval('public.quote_number_seq') unique,

  -- RESTRICT, deliberately. Properties CASCADE from a client because a
  -- property has no meaning without one; a quote is a financial record and
  -- must not be destroyed as a side effect. Clients are archived rather than
  -- deleted in normal use, so this only bites on a deliberate purge — where
  -- failing loudly is the correct behaviour.
  client_id    uuid not null references public.clients (id) on delete restrict,

  -- SET NULL: properties cascade when a client is purged, so RESTRICT here
  -- would deadlock the purge from two directions. The address the customer was
  -- shown survives in property_snapshot regardless.
  property_id  uuid references public.properties (id) on delete set null,

  -- SET NULL and never RESTRICT: purge_stale_leads() (migration 0001) deletes
  -- leads in status 'quoted' after 24 months, so this row is GUARANTEED to
  -- vanish eventually. Anything the quote needs from the lead is copied at
  -- creation, not joined at render.
  lead_id      uuid references public.leads (id) on delete set null,

  title        text,

  -- draft            — being written, totals resolve against live settings
  -- sent             — issued to the customer, everything frozen
  -- viewed           — customer opened the public link
  -- approved         — customer accepted
  -- changes_requested— customer asked for something different
  -- declined         — customer said no
  -- converted        — became a job
  status       text not null default 'draft'
               check (status in ('draft','sent','viewed','approved','changes_requested','declined','converted')),

  -- Money -------------------------------------------------------------------

  -- Null means "follow the chain": quote → property → client → account
  -- default, resolved by resolveTaxRate(). Text, not uuid — rate ids are
  -- strings like 'qc'.
  tax_rate_id  text,

  -- The resolved rate, frozen when the quote leaves draft. Without this, an
  -- owner correcting the QST rate or filling in a registration number would
  -- retroactively rewrite every quote ever sent, because resolveTaxRate reads
  -- LIVE settings on every call.
  tax_snapshot jsonb,

  -- Mirrors the Discount type in src/lib/crm/money.ts exactly: value is cents
  -- when kind is 'amount', hundredths of a percent when 'percent'.
  discount_kind  text not null default 'none' check (discount_kind in ('none','amount','percent')),
  discount_value integer not null default 0 check (discount_value >= 0),

  deposit_kind   text not null default 'none' check (deposit_kind in ('none','amount','percent')),
  deposit_value  integer not null default 0 check (deposit_value >= 0),

  -- Computed by money.ts and written back on save. Derived data, stored on
  -- purpose: the list view and every report would otherwise have to load and
  -- re-total every line of every quote to show a column of numbers.
  subtotal_cents integer not null default 0,
  discount_cents integer not null default 0,
  tax_cents      integer not null default 0,
  total_cents    integer not null default 0,
  deposit_cents  integer,

  -- Frozen identity ---------------------------------------------------------
  --
  -- updateClient() rewrites the client row in place, so without these a quote
  -- reopened after an address correction would render an address that was
  -- never on the document the customer received.
  client_snapshot   jsonb,
  property_snapshot jsonb,

  -- Free text ---------------------------------------------------------------
  client_message text,   -- customer-facing note at the top
  contract_terms text,   -- customer-facing terms at the bottom
  internal_notes text,   -- never rendered on any customer document

  -- What the customer sees --------------------------------------------------
  show_quantities   boolean not null default true,
  show_unit_prices  boolean not null default true,
  show_line_totals  boolean not null default true,
  show_totals_footer boolean not null default true,
  require_signature boolean not null default false,

  -- Lifecycle ---------------------------------------------------------------
  valid_until  date,
  sent_at      timestamptz,
  viewed_at    timestamptz,
  approved_at  timestamptz,
  declined_at  timestamptz,
  converted_at timestamptz,
  archived_at  timestamptz,

  -- Public access -----------------------------------------------------------
  --
  -- A random token, not the row id. The id appears in admin URLs and server
  -- logs; a public link built from it would let anyone who ever saw one guess
  -- at others. Nullable until the quote is first sent.
  public_token text unique,

  -- Approval evidence -------------------------------------------------------
  --
  -- Approval is a status transition; the signature is optional evidence of it.
  -- What is NOT optional is recording who accepted what and when, because the
  -- selected optional line items are part of what was agreed.
  approved_by_name  text,
  approved_signature text,
  approved_ip       text,
  approved_user_agent text,

  -- Quebec compliance -------------------------------------------------------

  -- Charter of the French Language s. 55: contracts of adhesion and their
  -- related documents must be drawn up in French; the parties may be bound by
  -- another-language version only if that is their express wish AFTER the
  -- French version was remitted. Hence: French default, and the English path
  -- requires evidence of both steps, in order.
  language text not null default 'fr' check (language in ('fr','en')),
  french_version_remitted_at timestamptz,
  english_express_wish       boolean not null default false,

  -- CPA s. 25/32: a consumer contract required to be in writing must be on
  -- paper unless the consumer expressly authorises a technological medium.
  electronic_delivery_consent_at timestamptz,

  -- Itinerant-merchant regime (CPA ss. 55-65). TRUE when the contract is
  -- concluded away from our own address AND either we initiated the contact
  -- (reg. s. 7.1) or the work is doors, windows, thermal insulation, roofing
  -- or exterior cladding (reg. s. 7) — those are itinerant even when the
  -- customer asked us to come.
  --
  -- When true: a 10-day cancellation right applies, no payment may be taken
  -- and no work performed before it expires (ss. 60, 60.1), and the contract
  -- must carry every element in s. 58 — because omitting one stretches the
  -- cancellation window from ten days to a full year (s. 59).
  is_itinerant boolean not null default false,
  signing_address text,
  signing_date    date,
  -- Starts the 10-day clock. The customer is bound only once in possession of
  -- their copy (s. 33).
  contract_copy_delivered_at timestamptz,

  custom jsonb not null default '{}'::jsonb,

  -- An approved quote must record who approved it. Enforced here rather than
  -- in application code because the approval endpoint is public.
  constraint quotes_approval_is_evidenced check (
    status <> 'approved' or (approved_at is not null)
  )
);

create index if not exists quotes_client_idx  on public.quotes (client_id);
create index if not exists quotes_status_idx  on public.quotes (status);
create index if not exists quotes_updated_idx on public.quotes (updated_at desc);
create index if not exists quotes_token_idx   on public.quotes (public_token);

alter table public.quotes enable row level security;

-- ---------------------------------------------------------------------------
-- Quote line items
-- ---------------------------------------------------------------------------
--
-- Two kinds, as a discriminated union rather than a nullable-price hack:
--
--   'item' — priced work. Has quantity, unit price, taxability.
--   'text' — wording only: a scope heading, a warranty paragraph, an
--            exclusion. No money at all.
--
-- Modelling the text kind as an item with a null price would mean every
-- consumer of this table has to remember to skip nulls, and one that forgets
-- adds NaN to a customer's total.

create table if not exists public.quote_line_items (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- CASCADE: a line has no meaning without its quote. Same reasoning as
  -- properties under clients.
  quote_id   uuid not null references public.quotes (id) on delete cascade,

  -- Explicit ordering. Insertion order is not an order — the operator
  -- rearranges these, and "whatever the database returns" is not stable.
  position   integer not null default 0,

  kind       text not null default 'item' check (kind in ('item','text')),

  name        text not null,
  description text,

  -- Thousandths, so 320.5 sq ft and 0.25 hours are exact integers. A float
  -- column would reintroduce the drift the cents are there to prevent.
  quantity_milli   integer,
  unit             text,
  unit_cost_cents  integer,
  -- Signed on purpose: a negative unit price is how a discount line is
  -- expressed, and it must carry the same taxable flag as the work it reduces.
  unit_price_cents integer,

  taxable  boolean not null default true,

  -- An optional line is quoted but not included until the customer ticks it.
  -- `selected` persists their choice — it is part of what was agreed, so it
  -- belongs on the record, not in a session.
  optional boolean not null default false,
  selected boolean not null default false,

  -- Owner-side only, carried from the price book so job costing has something
  -- to compare against later. Never printed for the customer.
  labor_hours numeric,

  -- Where it came from. SET NULL because deleting a price book entry must not
  -- delete the quote line that was copied from it.
  price_book_item_id uuid references public.price_book_items (id) on delete set null,

  -- The union, enforced by the database. A text line with a price is a bug
  -- that would otherwise surface as an unexplained total.
  constraint quote_line_shape check (
    (kind = 'text' and quantity_milli is null and unit_price_cents is null and unit_cost_cents is null)
    or
    (kind = 'item' and quantity_milli is not null and unit_price_cents is not null)
  ),
  -- An unticked non-optional line is meaningless: mandatory work is always in.
  constraint quote_line_selection check (optional or not selected)
);

create index if not exists quote_lines_quote_idx on public.quote_line_items (quote_id, position);

alter table public.quote_line_items enable row level security;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
--
-- service_role bypasses RLS but NOT table grants. Omitting these produces a
-- runtime "permission denied" that type-checks perfectly — which is exactly
-- how the leads table broke in production once already.

grant all on public.price_book_items to service_role;
grant all on public.quotes           to service_role;
grant all on public.quote_line_items to service_role;
grant usage, select on sequence public.quote_number_seq to service_role;

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------
-- Reuses touch_updated_at() from migration 0004 — do not redefine it.

drop trigger if exists price_book_touch_updated_at on public.price_book_items;
create trigger price_book_touch_updated_at
  before update on public.price_book_items
  for each row execute function public.touch_updated_at();

drop trigger if exists quotes_touch_updated_at on public.quotes;
create trigger quotes_touch_updated_at
  before update on public.quotes
  for each row execute function public.touch_updated_at();

drop trigger if exists quote_lines_touch_updated_at on public.quote_line_items;
create trigger quote_lines_touch_updated_at
  before update on public.quote_line_items
  for each row execute function public.touch_updated_at();
