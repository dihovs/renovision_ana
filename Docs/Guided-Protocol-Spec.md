# Guided protocol — Phase 1 specification

**Status: Phase 1 rules BUILT as data with tests, 22 Aug 2026 — no interface, by design.**
`src/lib/crm/protocolRules.ts` is §2 of this document turned into a table, with
`src/lib/crm/protocolRules.test.ts` covering it (20 cases). The table below and
that file must agree; the file is the one that runs. **Nothing else is built** —
no migration, no screen. §3's table and §5's three placements are still
specification.

**Originally:** specified, not built. Approved as a direction by the owner
21 Aug 2026: *"I want my app to guide them to say, okay. Measure the humidity
and then check the baseboard. If accessible, if you can remove the bit of
flooring, check what's going on with the subfloor. Check the drywall, the
surrounding areas, and everything."*

Background and the argument for this shape: `Docs/Guided-Protocol-Proposal.md`.
Phase 1 is the derived checklist and nothing else — **no AI, no new screens
beyond the list itself.**

---

## 1. What it is

Marking an affected area generates a list of checks **for that area**. Each
check either satisfies itself from a record that already exists, or is
confirmed by a tap. Nothing blocks. One sheet, when the technician says they
are leaving, naming what is still open.

The list is the report's completeness expressed early enough to act on — not
a lesson, and not a form.

## 2. The rules

A rule is `(damage type, surface) → checks`. Each check carries an id, a
sentence in the imperative, a one-line *why* shown only in Guided mode, and a
**satisfaction rule** — how the app knows it is done.

Two satisfaction kinds, and the distinction matters:

- **`derived`** — a query over existing data. *"Take a reading"* is satisfied
  by a `moisture_readings` row on that room. The technician never touches the
  checklist; doing the work ticks the box.
- **`explicit`** — nothing in the database can prove it. *"Check behind the
  baseboard"* leaves no record unless the technician says so. These are
  confirmed with one tap, and the tap **is** the record — see §4 on why that
  is worth storing rather than inferring.

Checks are ordered: **find the extent first, then prove it, then respond.**
That is the order the work actually happens in, and a checklist in the wrong
order is one people scroll past.

### water · floor

| id | Check | Why (Guided only) | Satisfied by |
|---|---|---|---|
| `water.source` | Photograph where the water came from | The first thing a carrier asks, and the last thing anybody remembers to shoot | `derived` — a photo on this room |
| `water.category` | Record the water category — 1, 2 or 3 | Decides whether material can be dried in place or has to come out. Everything downstream depends on it | `explicit` (writes to the area) |
| `water.extent` | Trace how far the water went and mark where it stops | The wet edge is rarely the visible edge | `explicit` |
| `water.baseboard` | Check the baseboard on every wall touching this floor | Water wicks into the wall from the floor; the baseboard is the cheapest place to find out | `explicit` |
| `water.subfloor` | If the flooring can be lifted somewhere it will not show, look at the subfloor and photograph it | Where the real money is, and where a missed check becomes a callback three weeks later | `explicit`, dismissible as *not accessible* |
| `water.below` | Check the ceiling of the room below | Water goes down. If there is no room below, dismiss it — that is a fact the report can use | `explicit` |
| `water.reading` | Take a moisture reading in the affected material | | `derived` — a reading on this room |
| `water.reference` | Take a reading in the SAME material somewhere dry | 18% means nothing on its own. It means something against the same wall in a dry room on the same day | `derived` — a second reading flagged as reference |

### water · wall

| id | Check | Why | Satisfied by |
|---|---|---|---|
| `water.source` | Photograph where the water came from | | `derived` |
| `water.category` | Record the water category | | `explicit` |
| `water.wick` | Take a reading above the visible line as well as at it | Water climbs. The stain stops lower than the moisture does | `derived` — two readings on this wall |
| `water.baseboard` | Check behind the baseboard | | `explicit` |
| `water.cavity` | Check inside the cavity and the insulation | Insulation holds water long after the drywall face reads dry | `explicit` |
| `water.otherface` | Check the other side of this wall, in the next room | One wall, two rooms, one claim | `explicit` |
| `water.floorbase` | Check the floor at the base of the wall | | `explicit` |
| `water.reference` | Take a reference reading in dry drywall | | `derived` |

### water · category 2 or 3 *(added once the category is recorded)*

| id | Check | Why | |
|---|---|---|---|
| `water.ppe` | Note the PPE used | | `explicit` |
| `water.remove` | Flag porous materials for removal rather than drying | Category 3 does not get dried in place | `explicit` |

### fire / smoke

| id | Check | Why | |
|---|---|---|---|
| `fire.wet` | Is this loss wet as well as burnt? | Extinguishing water is a water loss on top of a fire one, and it is scoped separately | `explicit` — answering yes adds the water checks |
| `fire.smokeline` | Photograph the smoke line | | `derived` |
| `fire.adjacent` | Check the rooms next to and above this one | Smoke travels further than heat and stains what the fire never touched | `explicit` |
| `fire.hvac` | Check the HVAC returns | The system distributes smoke through the whole building | `explicit` |
| `fire.odour` | Note the odour, and where | Odour is scoped and priced, and it is not visible in a photograph | `explicit` |

### mould

| id | Check | Why | |
|---|---|---|---|
| `mould.containment` | Note containment before disturbing anything | ⚠ Safety. Disturbing mould without containment spreads it through the building | `explicit`, **shown first and marked as safety** |
| `mould.extent` | Photograph the extent with something in frame for scale | Square footage is the whole of the pricing, and a photo without scale cannot prove it | `derived` |
| `mould.source` | Find what is keeping it wet | Mould is a symptom. Remediate without the source and it comes back on our warranty | `explicit` |
| `mould.cavity` | Check the cavity behind it | | `explicit` |

### impact

| id | Check | Why | |
|---|---|---|---|
| `impact.services` | Check for wiring and plumbing before opening the surface | ⚠ Safety | `explicit`, **safety** |
| `impact.structure` | Check the structure behind the surface | | `explicit` |
| `impact.extent` | Photograph the full extent | | `derived` |

### every loss, day 2 onward *(while equipment is on site)*

| id | Check | Satisfied by |
|---|---|---|
| `monitor.daily` | One reading per affected room today | `derived` — a reading on this room today |
| `monitor.running` | Confirm the equipment is still running | `explicit`, resets daily |

**Note on ceilings.** `affected_areas.surface` is `floor` or `wall` only, so
`water.below` and `fire.adjacent` currently point at a room rather than at a
ceiling area. That is fine for Phase 1 — the check is *"go and look"*, not
*"mark it here"*. A ceiling surface is a separate decision and should not be
smuggled in with this.

## 3. Data

One table. Everything else is derived at read time from records that already
exist, which is what stops the list and the job from ever disagreeing.

```sql
create table public.protocol_checks (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),

  project_id  uuid not null references public.projects (id) on delete cascade,
  -- The area the check belongs to. Null for the day-2 monitoring checks,
  -- which belong to the job rather than to any one patch of damage.
  area_id     uuid references public.affected_areas (id) on delete cascade,
  room_scan_id uuid references public.room_scans (id) on delete cascade,

  -- The rule id from the tables above: 'water.baseboard'. A string, not an
  -- enum, for the same reason `room_objects.kind` is one — this list will
  -- grow for years and a check constraint would mean a migration each time.
  check_id    text not null,

  status      text not null check (status in ('done', 'not_applicable')),
  -- Why it does not apply. "No room below" is a fact worth printing.
  reason      text,

  -- Who said so. On a claim this matters: the check is a professional
  -- assertion, and an assertion needs a name against it.
  actor       text,
  -- The day it applies to, for checks that reset daily. Null otherwise.
  applies_on  date,

  unique (area_id, check_id, applies_on)
);
```

**Derived completion is never written here.** A reading ticking off
`water.reading` is computed from `moisture_readings`, so deleting the reading
un-ticks the check automatically. Writing it down would let the two drift, and
a checklist that says done when the record is gone is worse than no checklist.

## 4. Why the taps are stored rather than inferred

The tempting shortcut is to treat *"check behind the baseboard"* as satisfied
when a note mentions the baseboard. Do not.

A stored tap is a **dated, attributed assertion by a named person that they
looked**. That is a different and much stronger thing than the absence of a
finding — and on a claim it is the difference between *"we checked the
subfloor, it was dry"* and *"nobody wrote anything about the subfloor."* The
second one gets argued with.

It also means `not_applicable` carries a reason, and the reasons are useful in
the report: *"Subfloor — not accessible without lifting finished hardwood"* is
a line an adjuster reads and accepts.

## 5. Where it appears

**Three places, and nowhere else.**

**On the affected-area editor** (`AreaEditor`, `FloorPlanView.swift:504`), under
the existing notes field: this area's checks. In Guided mode expanded with the
*why* lines; in Standard collapsed to a single row — *"3 checks outstanding"* —
that opens on tap. Safety checks are always expanded, in both modes, and
marked.

Every check row deep-links to whatever satisfies it: the reading form, the
camera, the category field. A `derived` check the technician taps takes them
to the screen that produces the record. An `explicit` check has a tick and an
overflow for *not applicable*.

**On the project**, a "Before you leave" sheet, opened by a *Done for today*
action. Lists only what is outstanding, grouped by room, each row deep-linked.
If nothing is outstanding it says so in one line and dismisses. This is the
one interruption the feature is allowed.

**On the project card**, a count of outstanding checks. Silent when zero.

## 6. Guided mode

A per-user setting, not per-company — `users.guided_protocol`, default true on
a newly created account.

| | Guided | Standard |
|---|---|---|
| Checks on the area editor | Expanded, with *why* | Collapsed to one row |
| Safety checks | Expanded | Expanded |
| Before-you-leave sheet | Always on *Done for today* | Only when something is outstanding |

He turns his off once. Nobody negotiates about how much guidance is right.

## 7. Offline

The derivation is a pure function of data already on the phone, so the list
works with no signal — which is the whole point, because the basement is where
the checks matter.

Taps queue exactly like photographs do (`PhotoQueue`): written to disk first,
sent when there is signal, shown as done immediately. A check the technician
ticked in a crawlspace must not un-tick itself when they surface.

## 8. What Phase 1 does NOT do

Stated so the scope does not creep while it is being built:

- **No AI.** Not the meter photo, not the explanations. Phase 3, separately.
- **No equipment sizing.** Phase 4.
- **No determinations.** The check says *record the water category*. It never
  says *this is Category 1*. The app prompts a professional to make a call and
  does not make it — his RBQ number is on the report.
- **No blocking.** Nothing in this feature may interrupt a scan, and no check
  may prevent generating a report. A report with outstanding checks prints;
  the sheet warned about it beforehand, which is the point.
- **No checks that are not derived from something on this job.** The first
  item that does not apply is the item that teaches people to ignore the list.

## 9. Build order inside Phase 1

1. The rules table as pure data with a `checksFor(area, job, today)` function,
   and unit tests over it. No interface. This is the whole design and it can
   be reviewed before a single screen exists.
2. The migration and the queue-backed writer.
3. The area editor section.
4. The before-you-leave sheet and the card count.
5. The `not_applicable` reasons into the report, under the room they belong
   to.

Step 1 is where the argument should happen. The rest is plumbing.
