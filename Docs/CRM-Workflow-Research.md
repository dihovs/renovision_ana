# The lead → money lifecycle: how the field-service CRMs model it, and what this one should do

**Researched 2026-08-02.** Products examined: Jobber, ServiceTitan, Housecall
Pro, Workiz, Buildertrend, Contractor Foreman, Kickserv, Simpro, and — because
it is the owner's actual trade — the restoration vertical (Encircle, CoreLogic
DASH, Albi, Xactimate).

Read against the code as it stands: `src/lib/crm/types.ts`, `quoteTypes.ts`,
`opsTypes.ts`, `clients.ts`, `quotes.ts`, `jobs.ts`, `invoices.ts`, `hub.ts`,
`money.ts`, `settings.ts`, and migrations `0001`–`0018`.

**A note on evidence.** These vendors document their marketing far better than
their behaviour. Claims below are tagged **[doc]** when they come from a
help-centre article, an official pricing page, or a statute, and **[inf]** when
they are read off marketing copy, a review aggregator, or a comparison site. Do
not treat an [inf] as a specification.

Three provenance caveats, because they bound how far this should be trusted.
**(a)** Several vendor help centres (Jobber, Housecall Pro, ServiceTitan, Workiz)
return HTTP 403 to automated fetchers; Jobber's articles were retrieved through
its public Zendesk search API and others through a browser session, so verbatim
quotes are [doc] but worth spot-checking before anything expensive is built on
them. **(b)** Jobber publishes GraphQL *type* names but not enum *members* — the
status strings below are UI labels from its help centre, not API constants.
Housecall Pro's enums come from a third-party mirror generated from its published
OpenAPI spec (its own docs site is a Stoplight SPA that blocks spec retrieval);
the inline descriptions are verbatim spec text, so confidence is high but it is
one step removed. **(c) Workiz's lifecycle could not be verified at all** — its
help centre and developer site were both unreachable and the search budget ran
out. Its permission model *was* confirmed. Treat every other Workiz claim here
as unverified.

---

## 0. The headline findings

Eight things, and five of them are not what you would guess.

1. **Nobody freezes documents as hard as this codebase already does, and that is
   a genuine advantage.** `sendQuote` snapshots client, property and tax rate at
   the moment of sending. Jobber and Housecall Pro re-render from live records.
   Under Quebec's Consumer Protection Act the copy remitted to the consumer is
   the one that binds, so "the PDF changed because someone fixed a typo in the
   client's address" is not a quirk here, it is a liability. Keep the snapshots.

2. **The frozen snapshot stops one hop too early.** `createJobFromQuote` copies
   the snapshots faithfully and then drops `deposit_kind`, `deposit_value` and
   `deposit_cents` on the floor. The customer approved "30% on signature" and
   nothing downstream knows.

3. **`createInvoiceFromJob` has no idempotency guard and no status guard.** Run
   it twice and the client owes double; run it on a cancelled job and it works.
   `createJobFromQuote` gets both of these right. This is the single most
   damaging defect found.

4. **Added work cannot be recorded on a job at all.** `job_line_items` are
   written exactly once, by `createJobFromQuote`, and there is no editor
   anywhere in `src/`. For a renovation company that is not a missing feature,
   it is a missing organ — and it happens to be the same organ Jobber and
   Housecall Pro are missing, which is where the sellable-product argument
   actually lives.

5. **Hiding pricing from the crew is normal, and Jobber makes it the default.**
   A new Jobber team member lands on the **Limited Worker** preset, which cannot
   see prices [doc]. The interesting part is *how* Jobber does it: `Show Pricing`
   is the root dependency for every commercial write permission in the product.
   Turn it off and the user also loses quote editing, invoice editing, payment
   collection, job costing and two-way texting — whether you wanted that or not.

6. **French is an open goal.** Not one product in this set has a French UI [doc].
   Jobber — a Canadian company — ships English-only on web and added *Spanish*
   (not French) to mobile, and only for non-admin users. Its Client Hub, the
   portal where a customer actually approves and pays, is not translatable.
   Meanwhile Housecall Pro **cannot represent GST + QST at all**: "only one tax
   rate can be applied to an invoice at a time" [doc].

7. **ServiceTitan enforces one invoice per job and cannot be talked out of it** —
   "an invoice ties directly to a single job and cannot be deleted or
   reassigned" [doc]. Multi-invoice work is pushed onto Projects, and
   ServiceTitan's own docs admit the seams: project invoices "are not connected
   to jobs or estimates and must be created manually", there are "known gaps in
   splits and reporting", and you are warned **"Do NOT mix job-level invoicing
   and project-level progress billing on the same project"** [doc]. That is a
   same-day-service data model with a construction module bolted *alongside* it
   rather than on top of it — and it is the clearest evidence in this whole
   research pass that the incumbents are not built for renovation.

8. **Knowify's architecture is the one worth stealing an idea from.** It does not
   convert anything. The Job exists from the lead stage and **its status is
   derived from which child artifacts exist** — `Bidding` appears automatically
   "if you have at least one line item and price entered in the proposal/bid
   section", `Pending changes` appears when a change order is in draft [doc].
   Nothing is destroyed at a hop, so nothing can be lost at one.

And one finding that reframes the whole exercise: **the two market leaders for
this company's size do not have change orders, and it is not an oversight.**
Jobber's is an open community feature request [doc]. For Housecall Pro the
absence was proven three ways — zero hits for `change_order` across its entire
published OpenAPI type surface, nothing relevant in its help centre search, and
no mention in the April 2026 estimates release notes that enumerated everything
else they shipped [doc]. Neither product models "the approved scope" as an
immutable baseline with deltas against it. **That is the hole.**

---

## 1. The canonical lifecycle across products

| | Intake | Estimate | Work | Scheduling unit | Billing | Money |
|---|---|---|---|---|---|---|
| **Jobber** | **Request** | **Quote** | **Job** — one-off or recurring | **Visit** (a job owns many; a one-off job **caps at 20** [doc]) | **Invoice** — several per job via progress invoicing [doc] | **Payment** |
| **Housecall Pro** | Lead / booking | **Estimate** | **Job** | The job *is* the appointment; multi-day is bolted on | **Invoice**, coupled tightly to the job | **Payment** |
| **ServiceTitan** | **Call** → **Booking** | **Estimate**, under an **Opportunity**, attached to a Job *or* a Project *or* neither | **Job** (Job Type + Business Unit + Campaign) under an optional **Project** | **Appointment** — a job owns many | **Invoice**, **1:1 with the job**, auto-created at booking, number = job number | **Payment** |
| **Workiz** | **Lead** | **Estimate** | **Job** | The job carries the schedule | **Invoice** | **Payment** |
| **Buildertrend** | **Lead Opportunity** | **Estimate** (internal) → **Bid Package** (to subs) → **Proposal** (client-facing) | **Job** with Schedule Items, **Selections**, **Allowances**, Daily Logs | Schedule Item | Invoices, **Draw Schedules**, **Progress Invoices** off the estimate's SOV | Payment |
| **Knowify** | *(no separate lead — the Job is created at lead stage)* | Proposal, a child of the job | **Contract job** vs **Service job**, two different modules | Phase (contract) / ticket (service) | Five locked invoicing styles; real **AIA G702/G703** | Payment |
| **Contractor Foreman** | Lead → Opportunity | Estimate | Project → Work Order | Scheduled task | SOV + **G702/G703** + retainage | Payment |
| **Kickserv** | Customer → **Opportunity** | Estimate | **Job** — the Opportunity *becomes* the job on approval | Visit inside a job | Invoice | Payment |
| **Service Fusion** | Customer | Estimate | **Job** | Job + "Additional Site Visits" | Single / Progress / No Charge | Payment |
| **Simpro** | Customer → Site → **Lead** | **Quote** | **Job → Section → Cost Centre** | Work order under a cost centre | Deposit / progress / final / **retention** claims, **per cost centre** | Payment |
| **JobNimbus** | **Contact** | Estimate | **Job** (contact- or job-centric workflows) | Work Order | Several invoices per job | Payment + Credit Memo |
| **Joist** | Client | **Estimate** | *(none — the estimate is the job)* | — | Invoice | Payment |
| **Encircle / DASH / Albi** | **FNOL / claim intake** | Xactimate estimate, adjuster-approved | Mitigation job + **daily drying log** | Site visit | Insurer invoice + deductible | Claim close-out |
| **This codebase** | **lead** (0001) | **quote** (0006) | **job** (0007) under optional **project** (0015) | **visit** (0007) + **job_recurrences** (0014) | **invoice** (0007), `is_deposit` flag | **payment** (0007) |

### The status enums, where they were confirmed

Worth reading closely — the enum is where a product's real model shows.

- **Jobber Quote — exactly 6** [doc]: `Draft` · `Awaiting Response` ·
  `Changes Requested` · `Approved` · `Converted` · `Archived`. Two rules worth
  noting against this codebase's `QUOTE_TRANSITIONS`: **"Once a quote has been
  sent (or marked awaiting response) it is not possible to put the quote back
  into draft status"**, and "Converted is a final status… the status will stay
  converted even if the linked job is deleted" [doc]. Jobber is *stricter* here
  than `quoteTypes.ts`, which allows `declined → draft` and
  `changes_requested → draft`.
- **Jobber Job — 10 list statuses** [doc], several derived rather than
  orthogonal: `Active` · `Upcoming` · `Today` · `Late` · `Unscheduled` ·
  `Action Required` · `Requires Invoicing` · `Ending Within 30 Days` ·
  `Archived`. `Action Required` means "still active, but no more upcoming
  visits… think of it like being 'on hold'"; `Requires Invoicing` is driven by a
  separate `InvoiceReminder` scheduling object rather than by work completion —
  a design choice worth *not* copying.
- **Jobber Invoice — 6** [doc]: `Draft` · `Awaiting Payment` · `Past Due` ·
  `Paid` · `Bad Debt` · `Voided`. Near-identical to `INVOICE_STATUSES` here,
  which has `viewed` and `part_paid` where Jobber has `Voided`. **`voided` is
  the more useful of the two additions** and is missing here.
- **Housecall Pro Job `work_status` — and the API contradicts itself** [doc,
  from HCP's published OpenAPI]. The value you *read back* is
  `needs scheduling | scheduled | in progress | complete rated |
  complete unrated | user canceled | pro canceled`; the value you *filter by* on
  `GET /jobs` is `unscheduled | scheduled | in_progress | completed | canceled`.
  Space-separated one way, snake_case the other, with different members. A
  cautionary tale about letting a list filter and a state machine drift apart.
  HCP's Estimate has no status enum at all — the real state lives on
  `EstimateOption`, which carries *two* independent fields, `approval_status`
  (`pro declined` / `pro approved` / `declined` / `approved` /
  `awaiting response` / `expired`) and `status` (eleven values including
  `submitted for signoff`, `timed out` and `created job from estimate`).
- **ServiceTitan Job** (5): `Scheduled` · `In Progress` · `Completed` · `Hold` ·
  `Canceled`. **Appointment** (7): `Scheduled` · `Dispatched` · `Working` ·
  `Hold` · `Canceled` · `Unused` · `Done` [doc]. Note the deliberate vocabulary
  fork — a job is *Completed*, an appointment is *Done*. `Unused` is "any
  appointment that doesn't have working timesheets on it when a job is
  completed", which is a nice way of admitting the schedule and reality diverge.
  **Estimate** (4): `Open` · `Sold` · `Dismissed` · `Expired`. **Opportunity**
  (5): `Open` · `Contacted` · `Unreachable` · `Won` · `Dismissed`. **Project**
  (7): `Bid` · `Pending Scheduling` · `Scheduled` · `Canceled` · `In Progress` ·
  `Completed` · `Hold`, with customizable sub-statuses [doc].
- **ServiceTitan Invoice — six independent axes rather than one enum** [doc]:
  *export* (`Pending` → `Posted` → `Exported`), *period* (`Open` / `Closed`),
  *review* (`Needs Review` / `On Hold` / `Reviewed`), *sent* (`Sent` /
  `Sent (Opened)` / `Not Sent`), *paid* (`Unpaid` / `Partially Paid` / `Paid` /
  `Overdue`), *batch*. **This is the best single design idea found in the whole
  survey** and §3 argues this codebase should adopt it.
- **Knowify contract job**: `Lead` → `Bidding` → `Out for signature` → `Active`
  → `Pending changes` → `Closed` / `Rejected`, **all derived from artifacts
  rather than set by hand** [doc]. **Knowify service job** carries *two*
  independent axes: operational (`Unscheduled` / `Scheduled` / `Completed` /
  `Closed`) and financial (`Not invoiced` / `Partially invoiced` /
  `Fully invoiced` / `Paid`) [doc].
- **Buildertrend Job** (4): `Pre-Sale` · `Open` · `Warranty` · `Closed`.
  **Change Order**: `Unreleased` → `Released` → `Approved` / `Declined` [doc].
- **Kickserv Opportunity**: `New` · `Estimate Scheduled` · `Estimate Sent` ·
  `Estimate Viewed` · `Lost`. **Job**: `Unscheduled` · `In Progress` · `On Hold`
  · `Completed` — note there is **no `Scheduled`** [doc].
- **Service Fusion** has the most granular enum of the lot, and it doubles as
  the time-tracking state machine: `Unscheduled` · `Scheduled` · `Dispatched` ·
  `Delayed` · **`On The Way`** · **`On Site`** · `Started` · `Paused` ·
  `Resumed` · `Partially Completed` · `Completed` · `Cancelled` · `Job Closed` ·
  `To Be Invoiced` · `Invoiced` · `Paid In Full` [doc]. `On The Way` starts
  drive time; `Started`/`Paused`/`Resumed` drive labour time.
- **JobNimbus Estimate** (API): `draft` · `sent` · `approved` · `denied` ·
  `invoiced` · `void` [doc].
- **Simpro Job**: `Pending` → `Progress` → `Complete` → `Invoiced` → `Archived`,
  and **each Cost Centre carries its own stage** [doc].
- **Workiz**: not confirmed. `help.workiz.com` and `developers.workiz.com` were
  unreachable to automated fetching, and the session search budget ran out
  before a workaround. Treat every Workiz lifecycle claim in this document as
  unverified — the only Workiz fact confirmed first-hand is its permission model
  (§4), which *was* read from its help centre.

### Which differences are meaningful

**Three genuinely different sales-stage architectures exist**, and choosing
between them is the real decision:

1. **Convert-and-consume** (Buildertrend, Contractor Foreman, Kickserv). The
   lead or opportunity is transformed into the job and ceases to exist as a
   separate record. Kickserv is explicit: "If the customer approves the estimate,
   the **Opportunity will transform into an unscheduled Job**" [doc]. Conversion
   is lossy in documented, specific ways.
2. **Derived status** (Knowify). The Job exists from day one; status is computed
   from which child artifacts exist. Nothing converts, so nothing is lost.
3. **Parallel containers** (ServiceTitan). Customer, Location, Job, Project,
   Opportunity, Estimate and Invoice all coexist as long-lived objects, and
   "conversion" is a **copy of line items** between them — conditional, one-way,
   and re-lockable.

**This codebase is currently a convert-and-consume design** (`lead` → `client`,
`quote` → `job`, `job` → `invoice`, each hop copying and each hop closing the
previous record). That is the right choice for a small operator: it produces a
clean audit trail of frozen documents. But it inherits convert-and-consume's
characteristic weakness — **whatever a hop forgets to carry is gone** — which is
exactly the deposit bug in §2.

**Meaningful — ServiceTitan splits Job from Appointment, and it matters.** The
Job is the commercial unit; the Appointment is a trip. That is exactly the
`job` / `visit` split already in migration 0007, and the comment in that
migration ("A job can need several trips: assessment, demolition, drying,
finishing… Modelling those as one date range on the job would lose the gaps,
and the gaps are exactly what the schedule has to show") is the same reasoning
ServiceTitan reached. This codebase is on the right side of the most important
modelling decision in the category.

**Meaningful — ServiceTitan also splits Customer from Location**, one-to-many:
"Multiple Location Records can be associated with the same Customer Record, but
a Location Record can only be associated with one Customer Record" [doc].
Equipment lives on the Location, billing on the Customer. That is `clients` and
`properties` in migration 0004, with the same cardinality. Also already right.

**Meaningful — ServiceTitan splits Job from Appointment, and it matters.** The
Job is the commercial unit; the Appointment is a trip. That is exactly the
`job` / `visit` split already in migration 0007, and the comment in that
migration ("A job can need several trips: assessment, demolition, drying,
finishing… Modelling those as one date range on the job would lose the gaps,
and the gaps are exactly what the schedule has to show") is the same reasoning
ServiceTitan reached. This codebase is on the right side of the most important
modelling decision in the category.

**Meaningful — Housecall Pro effectively collapses Job and Invoice**, and
**ServiceTitan enforces the collapse formally**: the invoice is auto-created when
the job is booked, its number matches the job number, and it "ties directly to a
single job and cannot be deleted or reassigned" [doc]. It buys speed for a
one-visit trade (arrive, do the work, invoice on the tailgate), and it is why
HCP reviewers report that "invoices end up being most frustrating for customers
on big multiday jobs" [doc, Capterra]. Do not copy this. A renovation job is
one commercial agreement billed several times.

**Meaningful — the container above the job.** ServiceTitan has **Project**;
Buildertrend's whole product is the container. Jobber does not have one, and its
substitute — convert the job to *recurring* once you exceed 20 visits — costs
you job costing entirely: "Reporting is not available for job costs on recurring
jobs" [doc]. Migration 0015 already added `projects` here, deliberately with no
money columns, which is the right shape: a project is a working folder that
groups financial documents, not a financial document itself.

**Cosmetic — Request vs Lead vs Booking.** Everyone has an unqualified intake
object. The only real question is whether it carries enough to triage, and
migration 0016 (`contact_role`, `is_emergency`, `heard_about`) already answers
that better than Jobber's Request does.

**Cosmetic — Estimate vs Quote.** Same object, different word.

---

## 2. One-click conversions: what carries, what freezes

### What the market actually does

**Intake → estimate carries nothing, in the market leader.** Jobber states it
twice, verbatim: **"The information from the request does not transfer into the
line items or any part of the quote directly"** [doc]. The request detail is
shown in a read-only side drawer for manual re-entry. So the recommendation in
Hop 1 below — push the estimator's `estimate_lines` straight into a draft quote
— is not catching up to the market, it is beating it at the very first hop.

**Freezing.** Jobber freezes at quote→job explicitly and says so: **"once a quote
has been converted to a job, any updates made to the quote do not appear on the
job. The job will reflect how the quote appeared at the moment it was
converted"** [doc]. Housecall Pro's button is literally labelled **"Copy to
Job"**, and its API description confirms the semantics [doc]. So copy-at-
conversion here matches the market exactly.

Where this codebase is genuinely ahead is *what* it freezes. Neither product
snapshots the addressee or the tax rate the way `sendQuote` does. Jobber's docs
could not be made to answer whether editing a client retroactively changes a
sent invoice; the schema hints at a copy (`InvoiceBillingAddress` is a distinct
type from `ClientAddress`) but `Job.property` is a live reference and editing
the Property record propagates [inf]. For Housecall Pro the question is
undocumented in either direction. **Snapshotting deliberately, and being able to
say so, is a real differentiator in a jurisdiction where the remitted copy
binds.**

The one place the market is ahead is that its snapshots are *versioned* — barely
— and this one is not. See §3.

**Copying, and how badly it can go.** ServiceTitan is the cautionary tale.
Selling an estimate does not link it to an invoice — it **copies line items,
conditionally**. On mobile, after the customer signs, the technician is asked
whether the work happens now. Answer yes and "the sold estimate items are added
to the job invoice"; answer no and they "are not added to the current job
invoice" and instead wait on a *Follow Up → Sold Estimates* tab to be booked into
a different job [doc]. There is **no automatic re-link to an already-booked
job** — ServiceTitan's own remedy is to re-key the tasks onto the invoice by
hand and then book-and-immediately-cancel a throwaway job purely to clear the
estimate off the follow-up screen [doc]. That is what a copy-based conversion
looks like when nobody guards the second copy, and it is worth reading twice
before extending `createInvoiceFromJob`.

**Deposits — Jobber's model is the one to copy, and it is documented in detail.**
A deposit attaches to the **quote only** (`Quote.depositRecords`,
`Quote.depositAmountUnallocated`); the client pays it through *Approve & Pay
Deposit* in Client Hub. On conversion "the deposit information will be visible
when creating or editing the job. **The deposit information does not appear on
the saved job, only the create or edit screen**" — the Job is a pass-through,
not a holder. Then the payoff: "if the quote (with a deposit) is converted to a
job, then later an invoice is generated, **the deposit will be automatically be
applied to the invoice** since it's linked to the original quote" [doc].
Unapplied deposits sit on the client's account balance; voiding an invoice
releases its deposit back there; and deposits can be moved between invoices for
the same client but **never between quotes**, "as a deposit on a quote
represents a financial commitment to that specific agreement" [doc].

That last sentence is the design principle. **The deposit belongs to the quote,
travels through the job untouched, and is netted at the invoice.** Housecall Pro
does it differently and worse — each deposit is its own invoice (`Job 100` →
deposit invoice `D-100`), and a percentage deposit **does not recalculate if
line items are added later**: "Delete the deposit and create a new one" [doc].

ServiceTitan runs deposits as a distinct
accounting workflow — pre-work payments are booked to a liability account and
released to AR on final invoicing, and mobile deposits are taken **from the
Estimate page, not the Invoice page** [doc], which is the right instinct: the
deposit belongs to the agreement, not to a bill. Simpro models it as an explicit
**deposit claim** alongside progress, final and retention claims [doc]. This is
the industry norm, and it is the thing `createInvoiceFromJob` does not do.

**Progress billing, ranked by how seriously each product takes it.** Knowify
(five invoicing styles, real G702/G703, retainage, stored materials, schedule of
values) → Simpro (deposit / progress / final / retention claims, **per cost
centre**, so billing granularity equals work-progress granularity — nothing else
does this) → Contractor Foreman (SOV, G702/G703 and retainage at a budget price)
→ Buildertrend (Progress Invoices generated from the estimate's SOV, plus Draw
Schedules on fixed-price jobs) → ServiceTitan (a real Application for Payment
with a continuation sheet carrying **Scheduled Value, % complete, Work Completed
This Period, Materials Stored, Retainage, Balance to Finish**, but project-level
only) → Service Fusion (% or $ per line item, mutually exclusive with single
invoicing *and* with deposits) → Jobber → JobNimbus → the rest. All [doc].

The continuation-sheet field list above is worth copying almost verbatim if
progress invoicing is ever built here; it is the distilled form of a century of
construction billing.

**Optional line items — exact match with Jobber.** "Any selected optional line
items will become regular line items on the job. **Any optional line items that
were not selected will disappear and not be included on the job**" [doc], with
the PDF still showing them greyed out as `Not included`. That is
`createJobFromQuote`'s filter, line for line. Jobber goes one step further and
recalculates a percentage deposit **live** against the client's optional
selections in the portal — worth copying, since `/q/[token]` already lets the
customer tick optional lines and `quoteDeposit()` already computes against a
total.

Housecall Pro's multi-option (Good/Better/Best) conversion contributes two rules
worth stealing, because they are the awkward cases nobody thinks about until
they happen [doc]: when approved options carry **different tax rates**, "the tax
rate from the first selected option will be applied to the job"; when they carry
**different discounts**, "the system will ask you to choose one … or select 'do
not apply any discount'". The first is a silent bug; the second is the right
pattern — ask, don't guess.

**One further Jobber quirk worth knowing before building batch anything**: batch
invoicing produces one invoice per client across their jobs, **except** that
jobs at properties with **different tax rates are forced onto separate
invoices** [doc]. In Quebec that is mostly moot, but the underlying rule — never
merge documents across tax rates — is right.

**Change orders — three designs, and one of them is clearly right.**

- **Buildertrend**: a first-class object with its own lifecycle (`Unreleased` →
  `Released` → `Approved`/`Declined`, plus an internally-declined state hidden
  from the client). Crucially, **an approved change order does not edit the
  estimate — it adds to the Job Price Summary** (client price + approved
  selections and allowances + approved change orders) [doc]. There is a setting
  literally named "Invoice Change Orders upon client approval". This is the
  design to copy.
- **ServiceTitan**: a change order is just an estimate with a **Change Order
  checkbox** ticked once it is sold, "so that the change order is accounted for
  in the Application for Payment summary" [doc]. Cheap to build, and it means
  contract value is simply the sum of sold estimates — ServiceTitan's project
  financials define *Contract Value* as "total price and tax of all Sold
  estimates" and *Change Orders* as "total price of sold change order estimates"
  [doc]. Also a reasonable design, and closer to what this codebase could do
  quickly since a change order would then be structurally a quote.
- **Knowify**: change orders exist on fixed-price jobs only, and reverting one to
  draft "requires deleting **all invoices including that change order**" — for
  AIA jobs, even invoices that did not bill it [doc]. That is the cost of doing
  progress billing properly, and it is a fair warning about ordering: build the
  billing ceiling before the change order, not after.

**Jobber has no change-order object at all** — the community thread on it is an
open feature request, not a feature [doc]. Neither Jobber nor HCP documents
**retainage / holdback**, which is routine on Quebec construction contracts.

### Per-hop, for this codebase

#### Hop 1 — `lead` → `client` + `property` (`convertLeadToClient`, clients.ts:284)

| | |
|---|---|
| **Carries** | name (split on the last space), one email as `main`/primary with both receives-flags true, one phone as `mobile`/primary with **`smsAllowed: false`**, the lead source label, and the raw address string into `property.street1` unparsed |
| **Does not carry** | the entire estimator output (`scope_summary`, `estimate_low/expected/high`, `estimate_lines`, `total_labor_hours`, `estimated_work_days`), lead photos, the consent record, the 0016 qualifiers, `claim_number` / `insurer`, notes |
| **Freezes** | nothing, correctly — a client is a living record |
| **Guards today** | idempotent on `lead.client_id` |

Three problems. First, **no duplicate check** — `contactMatch.ts` already does
phone/email matching for the call system and is right there. Every product in
the category dedupes at this hop, and failing to is the most-complained-about
data-hygiene defect in the market. Second, the lead→client link failure is
logged, not thrown (`clients.ts:335`), so a client can be created with the lead
left unlinked, ready to be converted again tomorrow. Third, and largest: **the
estimator output should become the first draft quote's lines.** The whole point
of having built an estimator is that the numbers shown on the website do not get
retyped by hand.

#### Hop 2 — `client` → `quote`

Composed by hand. Fine, and matches the market. Pre-fill from `estimate_lines`
and `scope_summary` per above.

#### Hop 3 — `sendQuote` (quotes.ts:419) — **the freeze point**

Resolves and freezes `tax_snapshot`, `client_snapshot`, `property_snapshot`,
mints a 32-byte `public_token`, stamps `french_version_remitted_at` when the
language is French, then recalculates totals against the now-frozen rate. Guards:
refuses anything that is not `draft` or `changes_requested`; refuses without an
RBQ licence on file.

This is the best-designed hop in the codebase. One guard is missing and the code
already knows it: **refuse to send in English unless `french_version_remitted_at`
is already set.** The field exists, the comment explains Charter s. 55, and
nothing enforces the ordering.

#### Hop 4 — `quote` → `job` (`createJobFromQuote`, jobs.ts:107)

| | |
|---|---|
| **Carries** | `client_id`, `property_id`, `quote_id`, `title`, `client_message` → `job.instructions`, `internal_notes`, all three snapshots verbatim, recomputed totals, and the filtered line items |
| **Deliberately drops** | unselected optional lines; the survivors are flattened to `optional:false, selected:false` so nothing downstream re-litigates scope |
| **Wrongly drops** | `deposit_kind`, `deposit_value`, `deposit_cents` |
| **Correctly does not carry** | the public token, the approval signature and IP, the status history — those belong to the quote, which remains the contract |
| **Guards today** | approved-only; idempotent on `(quote_id, archived_at is null)` |

Two fixes. The deposit must survive. And **`job.instructions = quote.client_message`
is a category error**: `client_message` is the covering note to the customer
("Thanks for having us out, here's what we propose"), and it is being written
into the one field a crew view would surface first. Job instructions should
start empty or from `property.access_notes`.

One guard worth adding that nobody in the market has: **refuse to convert an
expired quote** (`valid_until` in the past) without explicit re-confirmation.

#### Hop 5 — `job` → `visit` (`createVisit`, jobs.ts:239)

Carries nothing but `job_id`. Visits have no assignee, no arrival window
distinct from `starts_at`, and correctly no address of their own.

**No guards at all.** A cancelled or completed job will happily accept a new
visit; the status bump is conditioned only on `unscheduled`, so a cancelled job
stays cancelled but silently grows a calendar entry. That is the bug where the
office cancels and the crew still shows up.

#### Hop 6 — `job` → `invoice` (`createInvoiceFromJob`, invoices.ts:129)

Carries `client_id`, `property_id`, `job_id`, `quote_id`, `title`, both
snapshots, and either the job's lines verbatim or one synthetic deposit line.
Tax is `canChargeTax(company) ? job.tax_snapshot : NO_TAX` — a live gate over a
frozen rate, which is the right combination.

Broken three ways:

1. **No idempotency, no status guard.** Nothing prevents a second full-value
   invoice against the same job, and nothing prevents invoicing a cancelled one.
2. **No deposit netting and no link between the two invoices.** A deposit
   invoice sets `is_deposit` and bills a percentage; the final invoice then
   copies the entire job line list again at full value. Nothing subtracts what
   was already billed, and nothing relates the rows. The owner has to remember,
   forever.
3. **`depositPercent` is a caller argument, not `quote.deposit_value`.** The
   number the customer agreed to is in the database and is ignored.

Two smaller things. `due_date = today + quoteDefaults.validDays` reuses the
*quote validity window* as *payment terms* — two different business concepts
sharing one setting, which will diverge the first time either is tuned. And
`language` is hardcoded `'fr'` even when the quote the customer approved was in
English.

#### Hop 7 — `invoice` → `payment`

Nothing to carry. `sync_invoice_paid` (migration 0007) maintains
`amount_paid_cents` and promotes status **in the database**, which is better
than most of the market — application-side recalculation drifts the moment
someone adds a second code path. Keep it there.

---

## 3. Guard rails

### The three that matter most

**1. The sum of issued invoices against a job may not exceed its contract value,
and a second invoice must net the first.**

Not "one invoice per job" — renovation needs deposits and progress bills. The
invariant is that base value plus approved change orders is a ceiling, and
`createInvoiceFromJob` should take an explicit
`{ kind: 'deposit' | 'progress' | 'final', ... }` and refuse anything that
over-bills. This is the guard whose absence produces an actual customer dispute
rather than an internal annoyance, and it is currently absent entirely.

There is direct market precedent for the exact rule: Housecall Pro's progress
invoicing states "there are no limits to how many invoices you can create,
but… **you are not able to over-invoice more than 100% the cost of the job**"
[doc]. Jobber goes the other way and models it as a genuine many-to-many —
"you can generate more than one invoice on a job. Creating an invoice does not
close the job", and one invoice can roll in several of a client's jobs [doc].
Both are defensible. What is not defensible is the current state here, which is
many-to-one with no ceiling and no netting.

**2. Nothing moves forward on a cancelled job.** No new visit, no new invoice,
no recurrence generation. Cheap, unarguable, and it closes the crew-shows-up-
anyway failure. Note the asymmetry: *complete* should warn, not refuse — warranty
return trips and late receipts are normal.

**3. A sent document is immutable; a change makes a new document.**

Already true for quotes and it is the best decision in the codebase
(`isEditable`, `isFrozen`, `QUOTE_TRANSITIONS`). It is **not** true for invoices:
`updateInvoice` patches freely after sending and `setInvoiceStatus` will write
`paid` → `draft`. Extend the quote's discipline to invoices, and then add the
missing half — **quote revisions**. Today `changes_requested → draft` and
`declined → draft` mutate the same row, so the document the customer actually
saw is destroyed. The snapshots preserve *who* and *what tax rate*, not *what
lines*. That is also the Quebec compliance answer: you must be able to produce
the document that was remitted, and right now you cannot.

Two market data points sharpen this. **Jobber forbids the transition this
codebase allows**: "Once a quote has been sent (or marked awaiting response) it
is **not possible** to put the quote back into draft status" [doc]. And Jobber's
answer to editing an *approved* quote is instructive precisely because it is so
awkward — editing the total, deposit, line items, client message, disclaimer or
number strips the client's signature, forces an "I understand" acknowledgement,
and **saves the previous version as a PDF attached as an internal note**; but
the quote stays `Approved`, because "signatures aren't required to approve a
quote" [doc]. That is a versioning system implemented as a filing cabinet. It is
also proof that the problem is real and nobody has solved it well, which makes
it cheap to beat: a `quote_revisions` table storing the prior line set is
strictly better than a PDF in a notes feed.

### Guards that are annoying rather than load-bearing

- **Blocking "convert an unapproved quote."** This codebase refuses; **neither
  market leader does.** Jobber: "Quotes can be converted to jobs without either
  sending the quote… or marking the quote as sent" [doc]. Housecall Pro goes
  further and documents the bypass as a tip: "If some of your options have not
  been approved yet or were declined, you can still select them and copy them to
  a job. **Doing so will pro-approve those options**" [doc] — and `pro approved`
  is a first-class value in its `approval_status` enum, *distinct from customer
  approval*. That is exactly the right design and it is what should replace the
  hard refusal here: allow it, record who approved it and on what basis
  (`approved_by_name` already exists), and keep pro-approval visibly different
  from customer approval. A guard people route around teaches them to lie to the
  system; a guard that records the workaround teaches them to be honest in it.
- **Blocking a second job from one quote.** I had this backwards, and the
  correction matters: **Jobber supports it as a designed feature and does not
  even warn.** Its help centre has a heading "Can you make multiple jobs from
  the same quote?" answered "Yes! You can make as many jobs as you like from the
  same quote. This is useful if the client only wants one total Quote, but you
  would like to split these into multiple Jobs" [doc], and the schema agrees
  (`Quote.jobs` is a connection, plural). This is precisely the renovation case
  — one approved scope, a demolition job and a finishing job. Current behaviour
  here (silently return the existing job) is the worst of the three options: the
  owner clicks Convert, gets nothing, and is told nothing. **Allow N jobs per
  quote**, and let the invoice ceiling of guard 1 be what protects the money.
- **Locking a completed job.** Warn, don't refuse. Jobber's model is a `Reopen
  Job` action, and closing prompts you to choose between "complete past visits,
  remove future visits" and "remove incomplete visits" [doc] — a good pattern,
  because it forces the operator to say what happened to the work rather than
  leaving orphan visits on the calendar.
- **Hard-blocking a client delete.** Already correct here: `on delete restrict`
  on `jobs.client_id` and `invoices.client_id`, plus archiving. Note the split
  Jobber makes, which is worth copying wholesale: **delete is an unguarded
  permanent cascade** ("Deleting a client is permanent and will also remove all
  associated work… Deletions cannot be undone"), while **archive is the guarded
  operation** — blocked outright if active work exists, requiring quotes to be
  archived or converted, jobs closed, and invoices marked paid or bad debt
  first, and admin-only [doc]. Putting the guard on the *reversible* action and
  not the destructive one sounds backwards until you realise the destructive one
  is behind a confirmation and the reversible one is used daily.

### What the market blocks, for calibration

ServiceTitan has by far the most documented refusals, and they are worth reading
as a checklist because they are what a mature product ends up needing [all doc]:

| Blocked | Exact behaviour |
|---|---|
| Cancel a job with a payment | "Job cannot be canceled while invoice contains any payments" |
| Cancel a job (side effect) | "Invoice items are automatically deleted" |
| Reschedule after billing | "You can't reschedule a job once the invoice has been posted or exported" |
| Cancel one appointment | Impossible — "there is no way to cancel or uncancel a single appointment" |
| Edit an exported invoice | "You cannot edit exported invoices" — fix is an adjustment invoice |
| Edit a posted invoice | "You cannot add or remove tasks from a posted invoice" |
| Unpost after export | "Cannot unpost after export" |
| Delete an invoice | Prohibited outright; non-exported ones are voided by zeroing |
| Closed accounting period | "none of its transactions can be edited or exported" |
| Unsell a signed estimate | Blocked; workaround is Duplicate |
| Book the same sold items twice | Hard error, and permanently locked once marked not-to-be-performed |

Three of those are directly actionable here. **A `locked_at` / `exported_at`
column on `invoices` should exist before any accounting integration is
attempted** — retrofitting immutability after invoices have already been
exported is how books get restated. **Cancelling a job that has payments against
it must be refused**, which is a one-line check. And **accounting periods** are
the general form of the invoice-immutability guard: close a month, and nothing
inside it moves.

Jobber's own hard blocks are fewer but sharper on money: **payments cannot be
deleted at all** — "Jobber does not support canceling a completed payment. If
you need to undo a payment, issue a refund through Jobber instead", with a
documented workaround of editing the payment to $0.00 and adding a note [doc].
**Voided invoices are immutable** — "it cannot be edited, sent, or paid" — only
unpaid invoices can be voided, and the void reason is an enum (`Duplicate` /
`Created in error` / `Client request`) [doc]. Housecall Pro gates payment
deletion by method: "Deleting a payment is only supported for Cash, Check, and
Other payment methods. **Card payments can't be deleted**" [doc], and it has an
explicit **job lock** endpoint with a `locked_at` field for period close.

`deletePayment` here is unguarded. The market consensus — reverse, don't delete —
is right, and the `payments.amount_cents` column is already signed, so a
negative reversal row costs nothing to implement.

---

## 4. What the field crew sees

This is where the market is most instructive, because three vendors solved the
same problem three different ways and one of them is clearly right for a
company this size.

### How each product splits it

**Jobber — four presets, and pricing is the root of the dependency tree.**
The presets are **Limited Worker** ("Can view the schedule, mark work complete,
and track their time"), **Worker** ("Can view all clients, quotes, and jobs,
including pricing details"), **Dispatcher** ("Can edit job, team, and client
details"), and **Manager** ("Can manage all areas excluding reports and
payroll"); *Make Administrator* is a separate checkbox above the presets rather
than a fifth level [doc]. **A new team member defaults to Limited Worker** —
pricing-blind out of the box.

The toggle itself is called **`Show Pricing`**, and its help text is the most
useful sentence found in this entire research pass [doc]:

> "Allows users to see prices on quotes, invoices, and line items on jobs
> (including visits). Enabling users to see pricing unlocks other permission
> levels such the ability to edit quotes or invoices. This means that show
> pricing must be turned on first to give users permission to create and edit
> items such as quotes, invoices, and line items on jobs (including visits)."

So in Jobber, **pricing visibility is the root dependency for all commercial
write access.** Off means no quote editing, no invoice editing, no payment
collection, no job costing, no two-way texting. That is a real architectural
decision and it is defensible, but it should be made deliberately here rather
than inherited by accident.

The full custom-permission sections are: Schedule · Time Tracking and Timesheets
· Notes · Files and Media · Expenses · Show Pricing · Job costing · Marketing
Suite · Two-way Text Messaging · Clients and Properties · Requests · Quotes ·
Jobs · Chemical Tracking · Invoices · Payments · Reports [doc]. Two ladders are
worth stealing outright:

- **Schedule**: *view and complete their schedule* → *edit their schedule* →
  *edit everyone's schedule* → *edit and delete from everyone's schedule*.
- **Clients and Properties**: *view client name and address only* → *view full
  client and property info* → *view and edit* → *view, edit and delete*. On the
  lowest rung a crew member sees name and address **for their assigned jobs
  only** — no phone, no email, no history.

`Job costing` is gated behind four prerequisites (Show pricing + all timesheets +
all expenses + view all jobs) [doc], which is a neat way of expressing "you
cannot see margin unless you can already see every input to it".

**Housecall Pro — one blunt switch, and a structural dead end.** Three roles
only (Admin/Owner, Office Staff, Field Tech), no custom role builder. The toggle
is **`Take payments & see prices`** [doc]. Field techs **can only use the mobile
app and have no web portal access at all**, and HCP's own FAQ admits the
consequence: if a tech needs to see the company schedule you must promote them
to Office Staff, which "will give your Field tech access to log into the web
portal, and they will be able to see and edit all jobs and pricing on
invoices/estimates" [doc]. **There is no middle ground.** Also useful: HCP has
`Show techs next job` ("Ensures your employee can only see the next job they are
assigned to") as distinct from `Show techs full schedule`.

**ServiceTitan — granular, and the defaults reveal the philosophy.** Technicians
*sell*, so `View item prices` is **ON** by default and `View material costs` is
**ON**; `View equipment costs` and `Access Pricebook in mobile` are **OFF** [doc].
Notably, **there is no permission that exposes wages, commissions or bonuses to
a technician** — the only pay-adjacent toggles are "Technician is able to dispute
payroll" (on) and "Enable payroll approval module in mobile" (off) [doc]. Its
customer-data permissions are unusually fine-grained and worth copying wholesale:
separate toggles for `View customer phone numbers`, `View location phone
numbers`, `View customer emails`, `View job notes`, `View job attachments`, and
`View Historical Details` (**disabled by default** — gates customer notes, tags,
past jobs, documents and projects).

**Workiz — the cleanest implementation of exactly what this owner asked for.**
Settings → Users & Roles → Roles & Permissions → turn the **`Financial data`**
permission off. Verbatim: "Even if a user is restricted from seeing financial
data, they will still be able to access jobs, scheduling, and necessary customer
information. They will not, however, be able to collect online payments or log
offline payments" [doc]. There is a companion article for restricting a user to
assigned jobs. This is the target.

**Kickserv cannot do it at all**: "you cannot turn off the option to View
Contacts, Additional Contacts, Jobs, **Job Charges**, Time entries, and Notes for
a user" [doc]. **Simpro** gates it behind a mobile security group permission
literally named `View Pricing` [doc]. **Buildertrend** solves it by making subs
external portal users rather than seats: hidden by default are internal costs
and pricing, budget details, internal communications, internal notes and
customer contact info; visible are assigned Schedule Items, To-Dos, Daily Logs,
permitted file folders, RFIs, approved Selections and Job Info [doc].

### The note-visibility gap — nobody has solved it

Jobber's notes are "internal by default, so your client will not see them," and
are "viewable to all admin users or to team members with the user permission
setting for notes"; the only way to hide one from a user is to "remove their
permission to access the item where the note is saved" [doc]. Housecall Pro's
Private notes are visible to Admins, Office staff **and** Field techs [doc].

So **no product in this set has a per-note `crew | office` visibility flag.**
Both force you to smuggle office-only notes onto a different object. This
codebase already has the right split at the schema level — `job.instructions` is
crew-facing and `job.internal_notes` is office-only — and the only thing standing
between that and a better answer than the entire market is the Hop 4 bug that
fills `instructions` from `client_message`.

### What the technician app actually shows

Jobber's visit screen, enumerated [doc]: back arrow · **phone icon that dials
the client's primary number directly, unmasked** · text-message icon · a type
glyph (green truck = Visit, blue clipboard = Task, yellow calendar = Event) · job
status · title · **property address**, tappable to copy or open in Apple Maps /
Google Maps / Waze · directions icon · **On my way** icon · start date ·
**arrival window** · **Start Timer** · **Complete Visit** · More Actions (get
directions, schedule new visit, delete visit). Three tabs: **Visit**
(instructions, checklists, line items, schedule details, assigned team),
**Details** (client link, custom fields, job link), **Notes** (add + history).

Checklists are configurable forms — checkboxes, dropdowns, short and long answer,
**images**, **signatures** — and incomplete required fields raise a warning on
Complete Visit. Notes accept attachments and carry a **GPS waypoint recorded
where the note was created**. Time tracking is both a general clock-in/out and
per-visit timers that auto-pause the general one.

Hidden by default for a Limited Worker: all pricing, job costing, expenses,
reports, other people's schedules, full client contact info. Always visible
regardless of permission: instructions, checklists, address, arrival window.

### The crew-visibility matrix for this codebase

**Rule of thumb, one sentence: the crew sees what it takes to do the work and
prove it was done; the office sees what it takes to price the work and get paid
for it.** Anything with a dollar sign is office-only unless the crew member is
expected to sell or collect on site — and this crew is not.

| Field | Office | Crew | Customer (`/hub/[token]`) |
|---|---|---|---|
| `clientDisplayName` | full | full | own |
| `clientPersonName` | full | full | own |
| `phones[]` primary | full | **shown, click-to-call** | — |
| `emails[]` | full | hidden | own |
| `billing_*` address | full | hidden | own |
| Service address + map link | full | full | own |
| `property.access_notes` | full | **full — the crew's single most valuable field** | hidden |
| `property.notes` | full | full | hidden |
| `job.title` | full | full | full |
| `job.instructions` | full | full | hidden |
| `job.internal_notes` | full | **hidden** | hidden |
| `visit.starts_at` / arrival window | full | own visits (configurable: all) | own |
| Assigned crew names | full | full | full — Jobber sends them; do the same |
| `checklist_items` | full | full, editable | optional |
| Line `name` + `description` | full | full | full |
| Line `quantity_milli` + `unit` | full | full | per `show_quantities` |
| Line `unit_price_cents` | full | **hidden** | per `show_unit_prices` |
| Line `unit_cost_cents` | full | **never** | never |
| Line `labor_hours` | full | full — it is the plan for the day | never |
| `job.subtotal/tax/total_cents` | full | **hidden** | full |
| Quote status | full | **approved yes/no only** | own |
| `approved_signature`, `approved_ip` | full | never | own |
| `quote.deposit_cents` | full | hidden | own |
| Invoice existence + status | full | hidden | own |
| `payments[]` | full | hidden | own |
| `expenses` | full | own entries only | never |
| `time_entries.minutes` | full | own entries, editable same-day | never |
| Labour cost / wage | full | **never** | never |
| `marginHundredths` | full | **never** | never |
| Photos | full | full, upload | curated subset |
| WhatsApp thread on the job | full | full | own messages |
| `claim_number` / `insurer` | full | hidden | own |

Four implementation notes.

- **"Never" means absent from the API response, not hidden by CSS.** The crew
  view must be a different query. `getHubData` already sets this precedent
  correctly — it derives `client_id` from the token and never accepts one from
  the request — and the crew view should be built the same way.
- **Ship three roles, not thirty toggles.** `owner | office | crew`, plus one
  escape hatch ("this crew member may see prices") for the day a lead hand
  starts quoting small jobs. Jobber's sixteen permission sections are the right
  answer for a 40-person HVAC shop and the wrong answer here. Workiz's single
  `Financial data` switch is the model.
- **Decide the `Show Pricing` question deliberately.** Jobber couples pricing
  visibility to commercial write access because a user who cannot see a price
  cannot sanely edit one. That coupling is correct and should be copied — but
  *state* it, rather than discovering it later when a crew member cannot add a
  line item.
- **Beat the market on notes in an afternoon.** A `visibility: 'crew' | 'office'`
  column on note-bearing rows is a few hours of work, and no incumbent has it.

---

## 5. Notifications

This section is thinner than the rest and honestly so: vendor help centres
document *that* notifications exist far better than *when* they fire. Default
reminder lead times, review-request delays and overdue cadences could not be
confirmed and are marked as gaps rather than guessed at.

### The one that sets the norm: "on my way"

**It is a manual button press in both Jobber and Housecall Pro, not a GPS
trigger** [doc]. In Jobber the technician taps an **On my way** icon on the visit
screen and selects how many minutes away they are, which is injected into a
pre-written message; the text includes a **link to Client Hub showing the
appointment details and the assigned team members** [doc]. It requires only the
lowest client-info permission rung, which tells you Jobber considers it a
scheduling courtesy rather than a commercial action. If the client has no
text-enabled number the button does not appear.

Housecall Pro's version has a detail worth copying outright: **inbound customer
replies re-route based on OMW state.** Before OMW, replies go to the office
point of contact; between OMW and Finish, "any messages sent by a customer …
will be sent to the technician dispatched to the customer's job" [doc]. That is
a genuinely good pattern and it costs almost nothing to implement.

ServiceTitan markets live GPS technician tracking with ETA [inf, unverified].

### Customer-side, per transition

| Transition | Channel | Notes |
|---|---|---|
| Quote sent | Email (+ SMS) | Already built here (`sendDocument.ts`) |
| Quote viewed | Notify the office, not the customer | Already built (`recordQuoteView`) |
| Quote follow-up | Email | Built: 5 days in `sent` (`followups.ts`) |
| Quote approved / changes requested / deposit received | Notify the office | Jobber routes each to a designated reply-to team member per stream [doc] |
| **Booking confirmation** | Email or SMS, **manual** in Jobber | Explicitly distinct from a reminder: "sent once work is booked, prior to any appointments" [doc] |
| **Visit reminder** | Email or SMS, per-type on/off and configurable frequency | Offset is relative to the appointment time, not a clock hour: a 7am Thursday job reminded "one day before" fires 7am Wednesday [doc]. Common default is 24h [inf] |
| **On my way** | SMS, manual, with a minutes-away figure and a portal link | See above |
| Job complete → review request | Email/SMS after a delay | **Delay default not confirmed** |
| Invoice sent / viewed / paid | Email | Built |
| Invoice overdue | Email | Built: 3 and 14 days overdue. Market cadence **not confirmed** |

### Crew-side

Documented thinly. Jobber's permissions article opens by promising to "keep them
in the loop with a notification anytime their schedule changes" [doc], so
assignment and reschedule notifications exist, but channel and configurability
are not documented in what could be read. Workiz has an article titled *Sending
automated notifications for rescheduled jobs* [title only]. ServiceTitan's
`Allow full access to customer chats` and `Send emails from technician email
address` are both **off** by default — the pattern being that the technician is
a recipient, not a sender, unless promoted.

**The recommendation for this codebase**: crew gets *assigned*, *rescheduled*,
*cancelled* — those three and nothing else. Anything more and the notifications
get muted, at which point the important one is muted too.

### What is actually available here today

Email only, via Resend. `PhoneContact.smsAllowed` exists on the client record,
is set `false` by `convertLeadToClient`, and **is never read anywhere**. WhatsApp
is inbound-only. Twilio is already wired for voice, so SMS is a small addition
with a large effect — SMS is the category default for everything scheduling-
related, and none of the three notifications that matter most (booking
confirmation, reminder, on-my-way) work over email.

---

## 6. Where these products are weak

**Multi-day work is the fault line, and it is structural rather than cosmetic.**
Jobber's one-off job **caps at 20 visits** [doc]; past that you must convert to a
recurring job, and "reporting is not available for job costs on recurring jobs"
[doc]. So a renovation that outgrows twenty appointments loses job costing
entirely — a documented dead end, not a matter of taste. There is no Gantt, no
dependency, no phase, no critical path in any of Jobber, HCP or Workiz.

**No change orders** in Jobber (open feature request) or HCP; Buildertrend has
them but on higher tiers only. **No retainage/holdback** documented in Jobber or
HCP, which is routine on Quebec construction contracts.

**Cost, and the shape of it.** Jobber's published tiers: Core $49, Connect $139,
Grow $199, Plus $299–699, **plus $29/month per additional user on every tier**
[doc]. Two-way SMS is Grow and above. ServiceTitan publishes nothing; aggregators
put it at $245–500 per technician per month on a 12-month minimum [inf], and the
sharpest documented complaints are contractual rather than functional —
"the cancellation terms are brutal and they are not clearly communicated
upfront", early-termination exposure in the tens of thousands, support cases
"closed without a resolution being found" [doc, Software Advice]. Housecall Pro:
$59 / $149 / $299 by seat count, roughly $35 per user after, "they charge for
every extra thing", and **76+ BBB complaints clustered on billing** [doc].
Buildertrend removed public pricing in 2026 and now quotes on annual construction
volume.

**QuickBooks sync is a Quebec landmine.** Jobber publishes an entire library of
sync-failure articles, which is itself the evidence. The dangerous one: "the tax
rate on an invoice could not be found in QuickBooks so another tax rate was used
instead" [doc] — a **silent wrong-tax substitution**, with tax rate *names*
required to match QBO exactly. A two-rate GST + QST setup is precisely the
configuration most likely to trip it.

**What a small Quebec renovation company would find infuriating**, in order:
paying per seat for crew who only need to see a schedule; discovering that
hiding prices from a worker also disables things they did need; no change orders
on the one job type where scope always moves; an English approval portal in
front of a French-speaking homeowner; and, in Housecall Pro's case, being unable
to put GST and QST on an invoice at all.

---

## 7. Bilingual and Quebec specifics — the genuine gap

### GST + QST

The rule [doc, Revenu Québec]: since **1 January 2013**, GST 5% and QST 9.975%
are **both applied to the pre-tax base**; QST is no longer compounded on GST. On
$1,000 that is GST $50.00 and QST $99.75 for a total of **$1,149.75** (the
pre-2013 compound method gave $1,154.74). Both must be **broken out separately** —
a blended 14.975% line is not compliant.

`money.ts` already computes components in parallel against the discount-adjusted
taxable base, and `DEFAULT_TAX_RATES` already carries GST and QST as two
components with per-component registration numbers. **This is correct today.**

The market:

- **Jobber — works.** Named rates can be combined into a **tax group**, "the
  group tax rate will be the sum of the individual tax rates" (parallel, correct)
  and "the rates will appear individually for your clients to see the breakdown"
  (separate display, correct) [doc]. No Quebec-specific guidance exists; all
  examples are US state and county.
- **Housecall Pro — structurally fails.** "Only one tax rate can be applied to
  an invoice at a time" [doc]. No tax groups. Its Automated Sales Tax is
  explicitly US-only. The only workaround is a blended rate, which is not
  compliant.
- **ServiceTitan — hostile.** Tax zones are keyed to **ZIP codes**; a "charge
  multiple taxes for this zone" option exists but "must be enabled by
  ServiceTitan Technical Support" [doc]. No mention of Canada, postal codes,
  GST, PST or QST anywhere in the setup documentation.

### French

**No product in this set has a French UI** [doc]. Jobber — a Canadian company —
is English-only on web; its mobile app added **Spanish**, and only for non-admin
users (promote a Spanish-app user to admin and it reverts to English) [doc].

Jobber gets partway on customer-facing documents and then stops. **Editable**:
all client notification email and SMS templates, PDF contract and disclaimer
footers, custom fields surfaced on client PDFs. **Not editable** [inf, from
documented absence]: the hardcoded PDF chrome ("Quote", "Subtotal", "Total",
"Balance Due", "Due Date", "Qty", "Unit Price") and **Client Hub**, the portal
where the customer actually approves and pays. So a Quebec homeowner receives
French body copy inside an English skeleton and lands on an English approval
portal — arguably worse than no French at all, because it looks handled.

What the law requires [doc, Charter of the French Language / Bill 96, and the
Consumer Protection Act]:

- **s. 55 — contracts of adhesion** (a standard renovation contract template is
  one): drawn up in French and **remitted in French first**; another language
  only afterward and by express wish. In force 1 June 2023.
- **s. 57 — invoices, receipts and acquittances**: French required; bilingual
  only where French is **at least as prominent** and the terms at least as
  favourable.
- **s. 52 — commercial publications**, extended to websites and social media.
- **s. 58 — signage and advertising**: French "markedly predominant", quantified
  since 1 June 2025 as **at least twice the space**.
- OQLF registration threshold dropped from 50 to **25 employees** (1 June 2025).
  Penalties **$3,000–$30,000** per offence for corporations, doubled on repeat.
- **Consumer Protection Act**: written contracts "clearly and legibly drawn up in
  French and in 2 copies", the French copy delivered first, at no charge to the
  consumer [doc, OPC]. And a contractor signing at the client's home is an
  **itinerant merchant** for doors, windows, insulation, roofing and exterior
  cladding — mandatory written contract plus a **10-day waiting period before
  work may begin**.

That last point deserves emphasis, because `quotes.is_itinerant`,
`signing_address`, `signing_date` and `contract_copy_delivered_at` already exist
in migration 0006 — **but nothing enforces the 10-day delay.** A guard that
refuses to schedule a first visit within ten days of an itinerant contract
signing is a small amount of code and something no competitor has.

### RBQ licence

Required [doc, RBQ] on **estimates, bids, contracts, account statements and
invoices**; on **all advertising** including business cards, websites and
professional social networks; on construction-site signs; and on vehicles
bearing the business name. The prescribed format is **"RBQ licence: XXXX-XXXX-XX"**
(ten digits).

`sendQuote` and `sendInvoice` already refuse to issue without it, citing Building
Act s. 57.1. **That is stricter than every product surveyed.** Jobber can only
achieve it via a custom field or a free-text disclaimer footer, with nothing
enforcing that it appears on every document type; for HCP, ServiceTitan and
Buildertrend no documentation of a licence-number field printing to customer
documents could be found [inf, unverified].

### Is the Quebec gap real?

Half. Nobody large serves it. But a French-first local cohort is forming and is
aiming at the same customer: **Constructo AI** markets a Quebec construction ERP
at **$79.99/month all-in** claiming RBQ and CCQ compliance, TPS/TVQ, source
deductions, progress invoicing, retenues and "gestion des extras" [inf, their
marketing only]; **ChantierOS** markets a one-time-payment AI suite that claims
to auto-insert the RBQ number in the correct format [inf, marketing only].
Neither has been verified beyond its own website, and the feature lists are
implausibly broad for the price — but the positioning is taken. **A sellable
product cannot win on "we speak French and know about the RBQ" alone.**

---

## 8. The restoration angle nobody else covers

Worth stating because it is the owner's actual trade and because it is the one
place where a defensible product could exist.

The restoration lifecycle is a different shape: **FNOL / claim intake →
mitigation authorisation → daily drying log → Xactimate estimate → adjuster
approval → repair scope → invoice split between insurer and deductible → claim
close-out.** **Xactimate** (Verisk) is the de facto estimating standard and
insurer-side approval effectively runs through its line items and XactAnalysis.
**Encircle** is a documentation platform, explicitly "not a complete job
management or accounting system" [doc]: it models floor plans with evidence
pinned to locations, moisture readings plotted onto those plans, contents
inventory, drying progress over time, and adjuster-shareable reports — with **no
real-time Xactimate integration**, only export-and-attach [doc]. **CoreLogic
DASH** and **Albi** go from intake to close-out with tighter Xactimate links
[inf].

The gap: **nothing in the generic field-service category models the
insurer/deductible invoice split**, and `leads.claim_number` and `leads.insurer`
already exist here as reserved columns in migration 0001. A single job producing
two invoices — one to the insurer, one to the homeowner for the deductible,
both netting against one contract value — is a small extension of the invoice
model recommended in §3 and it is worth real money to a Laval water-damage
company.

---

## 9. The recommended lifecycle, in this codebase's own nouns

```
lead ──convertLeadToClient──▶ client (+ property)
                                 │
                                 ├─▶ project              (optional container, 0015)
                                 ▼
                               quote ──createJobFromQuote──▶ job
                                 │                           │
                                 │                           ├─▶ visit ×N  (+ assignee)
                                 │                           ├─▶ checklist_items
                                 │                           ├─▶ time_entries / expenses
                                 │                           └─▶ change_order ×N   ◀ NEW
                                 │                                    │
                                 └──────────────────────────────┬─────┘
                                                                ▼
                                       createInvoiceFromJob ──▶ invoice ×N ──▶ payment ×N
                                       {kind: deposit|progress|final}
```

Seven changes, in dependency order. Only two new top-level nouns: `change_order`
and `user`.

1. `quote.deposit_*` survives into `job`.
2. `job` gains a `billed_cents` (or a view) so "what is left to invoice" is a
   number the system knows rather than one the owner works out.
3. **`change_order`** — a child of `job`, structurally a quote (lines, snapshots,
   public token, approval signature) that on approval appends to the job's
   contract value. The single biggest functional gap for renovation work, and the
   thing Jobber does not have.
4. `invoice` gains deposit/progress netting and a link to what it supersedes.
5. `visit` gains an assignee (a `visit_assignments` join if a trip is ever more
   than one person).
6. **`user` + `role`**, replacing the single `ADMIN_PASSWORD`.
7. Notification fan-out on transitions, customer and crew separately.

---

## 10. Prioritized gaps against what is already built

> **Moving target, 2026-08-02.** This list was written against the committed
> state (`0018_call_tasks.sql` and earlier). Work landing in parallel while it
> was being written already picks up several items: `0019_conversions.sql` adds
> **partial unique indexes** making each conversion hop idempotent at the
> database level rather than in application code — which is the stronger form of
> P0 #1, since a unique index keeps holding when a future code path forgets to
> check. `0020_crew_tokens.sql` plus `src/lib/crm/crewView.ts` add a per-job
> revocable crew link with **explicit column allow-lists** (`JOB_COLUMNS`,
> `LINE_COLUMNS`, `CLIENT_COLUMNS` = `first_name` and `phones` only), which is
> exactly the "different query, not a CSS class" rule from §4 and much of P2 #11.
> Re-check the list against `git log` before planning from it. The ordering and
> the reasoning should still hold; the checkboxes will not.

### P0 — correctness, and all cheap

1. A billing ceiling on `createInvoiceFromJob`: refuse anything that would take
   total issued invoices above the job's contract value. Double-billing is live
   today. (Market precedent: HCP's "not able to over-invoice more than 100%".)
2. Deposit netting, and read the deposit from the quote rather than from a caller
   argument. Copy Jobber's model — deposit lives on the quote, passes through the
   job, is applied automatically at the invoice.
3. An invoice state machine mirroring `QUOTE_TRANSITIONS`; stop `setInvoiceStatus`
   writing `paid` → `draft`. Add a **`voided`** status with a reason enum, which
   both Jobber and HCP have and `INVOICE_STATUSES` lacks.
4. Refuse visits, invoices and recurrence generation on a cancelled job; refuse
   cancelling a job that has payments against it.
5. Reverse payments rather than deleting them. `payments.amount_cents` is already
   signed; `deletePayment` on a settled invoice should become a negative row.
6. Separate payment terms from quote validity days.
7. Invoice `language` follows the quote or client, not a hardcoded `'fr'`.
8. Stop copying `client_message` into `job.instructions`.
9. Refuse an English quote before `french_version_remitted_at` is set — the field
   and the comment already exist.
10. Allow N jobs per quote (with the ceiling from #1 doing the protecting), and
    tell the operator what happened either way. Jobber treats this as a feature,
    not an error.
11. Add `locked_at` to `invoices` **now**, before any accounting integration
    exists. It is one column today and a data migration later.

### P1 — the two features that decide whether this is a product

9. **Users and roles.** `src/lib/adminAuth.ts` is one shared password with no
   users table, no roles and no per-record scoping. Nothing the owner asked for
   about crew visibility is possible until this exists, and it blocks P2 entirely.
10. **Change orders.** `job_line_items` are written once and never edited; there
    is no line editor anywhere in `src/`. Scope moves on every renovation.

### P2 — the visible half

11. Crew view: today's visits, address and navigate, `access_notes`,
    instructions, checklist, photo upload, time entry, on-my-way. Build it as a
    separate query, the way `getHubData` is.
12. Notifications: assigned / rescheduled / cancelled to the crew; booking
    confirmation, reminder and on-my-way to the customer.
13. SMS. Twilio is wired, `smsAllowed` exists and is never read.
14. Quote revisions (v1, v2, v3) instead of mutating back to draft.

### P3 — the sellable-product surface

15. Multi-tenancy: `company_id` on every table plus real RLS. Today RLS is
    enabled but everything runs as `service_role`, so there is no tenant concept
    at all. This is the largest single piece of work and it gets harder every
    week.
16. Progress invoicing by percentage or milestone, and holdback/retainage.
17. Job costing rollup: `time_entries` × a rate, plus `expenses`, against
    invoiced. Migration 0012 already stores everything needed and nothing reports
    on it.
18. Restoration: promote `claim_number` and `insurer` onto the job, add the
    insurer/deductible invoice split, add a drying log.
19. Itinerant-contract guard: refuse a first visit within ten days of an
    itinerant signing. The columns exist; the rule does not.

---

## 11. What would make this genuinely competitive — an opinion

**The Quebec angle is necessary and not sufficient.** French UI, correct
GST/QST, and an enforced RBQ number are table stakes for the market and this
codebase already has two of the three better than anyone surveyed. But Constructo
AI is selling a French Quebec construction ERP at $79.99/month, so "we speak
French" is a feature, not a moat. It gets you in the door of a conversation you
then have to win on something else.

**The moat is the shape of the work, not the language.** Every product in this
category was built for a one-visit trade — HVAC, plumbing, lawn care — and the
seams show the moment a job runs three weeks. Jobber caps a one-off job at twenty
visits and then takes job costing away. Housecall Pro collapses job and invoice
so multi-day billing is a known pain point in its own reviews. ServiceTitan
enforces one invoice per job and tells you in its own documentation not to mix
its two billing modes. **Neither Jobber nor Housecall Pro has a change order —
that is now a proven negative, not an impression** (zero hits across HCP's entire
published API surface; an open feature request on Jobber's community forum).
Neither documents holdback. The renovation-shaped products that *do* have those
— Buildertrend, Knowify, Contractor Foreman — cost four to ten times as much,
lock hard (Knowify: switching invoicing style mid-job means deleting and
recreating every prior invoice), and are built for builders running eight
simultaneous projects with a project manager, not for an owner-operator with
three crew.

**There is a real hole between $150/month Jobber and $500/month Buildertrend, and
it is exactly renovation-and-restoration-sized.** The product that fills it needs
four things, and only four:

1. **A job whose scope can change, with the change documented and approved.**
   Change order as a first-class object, customer-approvable through the portal
   that already exists at `/q/[token]`, appending to a contract value the invoice
   engine respects. This is the whole game.
2. **Money that adds up across a long job.** Deposit, progress bills, final,
   holdback, all netting against one contract value that the system will not let
   you exceed. Renovation is the trade where getting this wrong loses the
   customer, and it is the guard the codebase most conspicuously lacks.
3. **A crew view that is genuinely price-blind and genuinely useful.** Workiz's
   single `Financial data` switch is the right ergonomics; Jobber's
   `Show Pricing` dependency cascade is the right architecture. Add the one thing
   nobody has — a `crew | office` flag per note — and this is better than every
   incumbent on the axis the owner cares most about, for maybe two days of work.
4. **French as the default rendering, not a template edit.** Every label, the
   client portal, the approval flow, the receipt — with the RBQ number stamped
   automatically on every soumission, contrat, facture and état de compte, which
   `sendQuote` and `sendInvoice` already refuse to skip.

**And one thing to resist.** Do not chase feature parity with ServiceTitan. The
list of things it does that this does not is very long and almost none of it
matters to a company with three crew. The products that lose in this category
lose by becoming a worse ServiceTitan, not by being a smaller one.

**The honest risk.** Multi-tenancy is the piece of work that decides whether this
is ever sellable, it is not started, and it gets more expensive every migration.
`company_id` on every table plus real RLS policies is boring, invisible to the
owner, and should probably happen before change orders rather than after —
retrofitting a tenant column through eighteen migrations and a change-order
subsystem is materially worse than through eighteen migrations alone.

---

## Sources

**API schemas.** Jobber GraphQL type definitions, developer.getjobber.com/docs/
(Account, Assessment, Client, Expense, Invoice, Job, ProductOrService, Property,
Quote, Request, TimeSheetEntry, User, Visit — type names public, enum members
not). Housecall Pro OpenAPI, via the machine-generated mirror at
github.com/ToDucThanh/housecallpro-mcp (`src/types/housecall.ts`). ServiceTitan
Sales & Estimates API v2, developer.servicetitan.io/docs/api-resources-salestech/.
Simpro API job/section/cost-centre nesting, apiforum.simprogroup.com/viewtopic.php?t=2267.
JobNimbus public API, documenter.getpostman.com/view/3919598/S11PpG4x.
Zuper, developers.zuper.co/reference/get-job-details.

**Vendor documentation.** Jobber: User Permissions
(help.getjobber.com/hc/en-us/articles/115009568687), Jobs in the Jobber App
(.../8185260991127), Fieldworkers role guide (.../7453632138391), Notes and
Attachments (.../360000110368), On My Way Text Messages (.../7448087796631),
Assessment and Visit Reminders (.../360033608974), Tax Settings (.../115014367307),
Progress Invoicing (.../26297232277527), Create a One-Off Job (.../115009379047),
Job Costing (.../14343244961175), Common QuickBooks Sync Errors (.../10466688449431),
Spanish Language Mobile App FAQ (.../17188033308567), pricing page
(getjobber.com/pricing), change-order feature request
(community.getjobber.com/discussions/spring-feature-announcement/change-orders/2486).
Also Jobber: Quote Basics (.../115009378727), Quote List Page and Key Metrics
(.../39133000691095), Job Basics (.../115009379027), Jobs List Page
(.../39133110680343), Invoices List Page (.../39133270019991), Requests List
Page (.../39132874167959), Converting a Request to a Quote or Job
(.../360056871013), Converting a Quote to a Job (.../115009542728), Optional Line
Items on Quotes (.../360046575473), Deposits on Quotes (.../115009379007), Quote
Approvals (.../115012715008), Batch Create Invoices (.../115009687088), Invoice
Reminders (.../115009517847), Client Basics (.../115009450867), Client Archiving
(.../360043616593), Properties (.../115010161128), Jobber Payments Refunds
(.../115009611607), What if a Job Gets Canceled (.../360040986713), Sales
Pipeline (.../34647017424023).
Housecall Pro: Team Member Roles & Permissions
(help.housecallpro.com/en/articles/1073431), Invoice Settings: Customer View
(.../6088692), Job Notes 101 (.../2883273), Managing Tax Rates (.../5317989),
How to Copy or Convert Jobs and Estimates (.../2883009), Deposits (.../3066064),
Collect Deposits on Estimates (.../12151673), Progress Invoicing Basics and FAQs
(.../8142156), Delete a Payment (.../2842239), Unschedule and Undo Actions
(.../2823066), Jobs/Invoices — Delete, Cancel and Restore (.../2832091), What's
New in Estimates (.../14831533).
ServiceTitan: technician permissions (help.servicetitan.com/how-to/technician-permissions
and /explanation-of-field-mobile-app-technician-permissions-in-servicetitan),
Set Permissions for Role (/set-permissions-for-role), Set Up Sales Tax
(/docs/set-up-sales-tax-in-servicetitan), Customer and Location Records Overview
(/docs/customer-and-location-records-overview), Book Jobs and Schedule
Appointments (/docs/book-jobs-and-schedule-appointments), Statuses and Actions on
Jobs and Appointments (/docs/statuses-and-actions-on-jobs-and-appointments),
Understand Invoice Statuses (/docs/understand-invoice-statuses), Sell Estimates
(/docs/sell-estimates-in-servicetitan), Estimate Workflows
(/docs/estimate-workflows-in-servicetitan-and-servicetitan-mobile), Manage
Projects (/docs/manage-projects), Understand Project Statuses and Project
Financials, Progress Billing Overview (/v1/docs/progress-billing-overview-and-setup),
Use Change Orders (/docs/use-change-orders-to-reflect-cost-adjustments), Cancel a
Job (/docs/cancel-a-job), Edit an Invoice (/docs/edit-an-invoice), Use Accounting
Periods (/docs/use-accounting-periods), Unsell Sold Estimates
(/docs/unsell-sold-estimates).
Workiz: Restricting users from seeing financial data
(help.workiz.com/hc/en-us/articles/18055859340305), Restricting a user to
assigned jobs (.../18055840325521).
Buildertrend: Subcontractor Overview
(buildertrend.com/help-article/subcontractor-overview/), Change Order Software
(/project-management/construction-change-order-software/), Lead Opportunities
Overview, Estimate Overview, Invoice Overview, Selections and Allowances
Overview, Job Management, Financial Management Settings, QuickBooks FAQs.
Knowify: Managing contract jobs (knowify.zendesk.com/hc/en-us/articles/360034729191),
Managing service jobs (.../32443887605908), Tracking jobs by contract status
(.../360025900352), Invoicing styles (.../48338257761044), Creating an AIA
Invoice (.../47390845475348), Creating a retainage invoice (.../360013590511),
How to revert a change order to draft (.../360014043092).
Contractor Foreman: kb.contractorforeman.com — workflow overview, progress
billing invoices, G702/G703 AIA invoice, roles and permissions.
Kickserv: Permissions (help.kickserv.com/article/39-permissions), Estimates
(/31-estimates), Jobs (/32-jobs), Invoices (/33-invoices).
Service Fusion: job status list (servicefusion.zendesk.com/hc/en-us/articles/360001114352),
Progressive Billing (.../360050543112).
Simpro: Mobile Security General
(helpguide.simprogroup.com/Content/simPRO-App/Mobile-Security-General.htm), plus
Job List Report, Manage Project Jobs, Convert a Quote, Progress Claim, Retention,
Invoice Stages. Zuper: docs.zuper.co job categories. Joist: support.joistapp.com
(job/project entity absent — argued from absence).

**Statute and regulator.** Revenu Québec, Calculating GST and QST
(revenuquebec.ca/en/businesses/consumption-taxes/gsthst-and-qst/collecting-gst-and-qst/calculating-the-taxes/).
Charter of the French Language, CQLR c. C-11
(legisquebec.gouv.qc.ca/en/document/cs/C-11). Norton Rose Fulbright, *Doing
business in Quebec: language legislation*
(nortonrosefulbright.com/en/knowledge/publications/38625c3d/). Office de la
protection du consommateur, contract rules
(opc.gouv.qc.ca/en/consumer/topic/contract/rules). Régie du bâtiment du Québec,
Displaying your licence
(rbq.gouv.qc.ca/en/licence/fulfilling-your-obligations/displaying-your-licence/).

**Reviews and third-party comparison** (all [inf]). Software Advice ServiceTitan
reviews, Capterra Housecall Pro reviews, BBB Housecall Pro complaint record,
ContractorTalk threads, and pricing comparisons at rivetops.io, projul.com and
plenum.pro. Quebec-native competitors: constructoai.ca, monchantier.store,
submitx.ca — marketing pages only, unverified. Restoration: tradetechguide.com
Encircle review; CoreLogic DASH and Albiware marketing pages.
