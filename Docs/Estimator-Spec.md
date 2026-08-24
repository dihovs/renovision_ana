# The estimator — measurements to money

**Status: SPEC, nothing built.** Written 23 Aug 2026 at the owner's ask:

> *"We have to make the estimation side of it. It's going to take all the
> information included in the report and make an estimation. And you have all
> this data somewhere in our website backend, because my chat widget is fed by
> this data — there's a lot of line items with their pricing."*

He is right that the data is already there. **Most of this feature already
exists and is not connected to the other half of itself.**

---

## 1. What already exists

Read from the schema, not remembered:

| Piece | Where | State |
|---|---|---|
| **The price book** | `price_book_items` (migration 0006) | Item code (`FLR-LAM-INST`), name, category, unit, `unit_price_cents`, nullable `unit_cost_cents`, `labor_hours_per_unit`, `labor_class`, `taxable`, `keywords`, `exclusions`. Full-text index over name + keywords + code |
| **Quotes** | `quotes`, `quote_line_items` | Full lifecycle — draft → sent → viewed → approved → converted, editable only while draft, frozen totals after sending |
| **The link to a job** | `quotes.project_id` (migration 0023) | Already exists |
| **What is damaged** | `affected_areas` | Surface (floor/wall), damage cause, polygon, area |
| **What is in the room** | `room_objects` | `disposition` (none · remove · reset · replace · protect), `included`, `quantity` |
| **The drying record** | `drying_log` | Moisture readings, equipment in/out |
| **The measurements** | `projectStatistics.ts` | Floor area, gross and net wall area, perimeter, baseboard length, volume |

**The objects table was built for exactly this.** The owner's own words when
that model was decided: *"if there is damage, it needs to be counted, there is
installation involved also, I need to have an option to include or exclude it
like any other item."* `disposition` and `included` have been sitting there
waiting for an estimator to read them.

So this is a **bridge**, not a new system: turn what we measured into
quantities, match those to price book items, write quote lines.

## 2. The shape

```
affected areas ─┐
room objects   ─┤
drying log     ─┼─→  RULES  ─→  quantities  ─→  price book match  ─→  quote lines
measurements   ─┘   (data)     (derived)        (item_code / FTS)     (editable)
```

A rule is a condition and a line:

```ts
{
  id: "water.floor.remove",
  when: { cause: "water", surface: "floor" },
  itemCode: "FLR-DEMO-SF",
  quantity: (ctx) => ctx.area.areaSqFt,
  why: "Affected floor area, measured",
}
```

**Quantities come only from figures the app already computes.** Nothing in the
estimator measures anything itself — that is the same rule the dollhouse
follows, and for the same reason: two things that measure separately will
disagree, and here the disagreement is money.

Available today: affected floor area, affected wall area, room perimeter,
baseboard length (perimeter minus doorways — already correct), net and gross
wall area, volume, ceiling area, object footprint and count, equipment
unit-days from the drying log.

Not yet available and needed: **casing lengths** (linear metres of door and
window trim) — noted as worth borrowing in
`Docs/reference/polycam-spatial-report.md` §2.3, and it falls straight out of
opening widths and heights we already hold.

## 3. Five decisions that matter

### 3.1 Derived, and re-derivable, without destroying hand edits

An estimate must be re-runnable — the operator marks another affected area on
day two and the numbers have to follow. It must also be editable, because no
rule table survives a real building.

So every line carries its origin: **`derived` from a rule, or `manual`**.
Re-running replaces derived lines and never touches manual ones. A derived line
the operator edits becomes manual, and stops being overwritten.

Without this, the second run either silently discards the operator's judgement
or refuses to run at all, and both make the feature unusable on the second day.

### 3.2 A rule that cannot find its price produces a line with NO price

If `FLR-DEMO-SF` is not in the price book, the line still appears — with its
quantity, its unit, and an explicit "no rate" marker.

The schema already argues this position better than I can. From migration 0006
on why `unit_cost_cents` is nullable:

> *A guessed cost is worse than an absent one, because it produces a confident
> margin figure that is wrong.*

The same is true of a rate. A visible gap gets filled; a plausible invention
gets sent to an insurer.

### 3.3 Every derived line cites the measurement it came from

`Drywall removal — 24.5 m² — Living room · water · wall areas 1 and 2`.

An adjuster's first question about any number is where it came from, and a
line that answers it is worth more than a line that is merely correct. This
also makes the estimate checkable against the report beside it, which is the
whole reason both are generated from one set of measurements.

### 3.4 Units convert in exactly one place

The price book's `unit` is free text — `"sq ft"`, `"linear ft"`, `"each"`,
`"hour"` — and every measurement in this app is metric internally. That
conversion happens in ONE function, the same discipline `PlanTransform` already
enforces for plan metres to canvas points. A second conversion site is a
four-percent error nobody can find.

### 3.5 Rules are data with tests, before any screen

The same shape the owner already approved for the guided protocol: *the rules
ARE the design, and he can review them before a screen exists.* A rules table
in TypeScript with vitest coverage, reviewed as a table, then a screen.

## 4. What I cannot write without him

**The rules themselves.** I can build the machinery — the rule type, the
derivation, the matcher, the line writer, the tests. I cannot write the
mapping, because it needs two things I do not have:

1. **The actual contents of the price book.** I can read the schema; I cannot
   query the database. I do not know which item codes exist, how the categories
   are named, or how granular they are. A rules table written against invented
   codes is worthless.
2. **His trade judgement.** Which line items a Québec water-damage job actually
   bills, in what order, and with what conventions.

**The fastest path is a CSV export of `price_book_items`** — code, name,
category, unit, price. From that I can draft the rules table against real
codes, and he reviews it as a table rather than as software.

## 5. Questions only the owner can answer

1. **Flood cut height.** Drywall removal on a wet wall is priced by area, and
   the area depends on how high the cut goes. Is it a standard 2 ft, 4 ft, or
   decided per job?
2. **Labour.** `labor_hours_per_unit` and `labor_class` exist on every item.
   Should the estimate total hours and crew classes as well as money, or is
   labour inside the unit price for his work?
3. **Cost and margin.** `unit_cost_cents` starts null by design. Does he want
   internal cost tracked so the estimate can show margin, or is sell price the
   only number?
4. **Who signs off.** Should a generated estimate land as a `draft` quote for
   review — the safe default — or is there a case for anything further?
5. **Equipment.** The drying log records equipment in and out. Are dehumidifier
   and air-mover days billed per unit-day off that record, which we already
   compute?

## 6. Suggested order

1. **Export the price book** and draft the rules table against real codes.
2. **Rules + derivation + tests**, no screen — reviewable as a table.
3. **Write into a draft quote** on the project, derived lines marked as such.
4. **Casing lengths**, since the trim rules need them.
5. **The screen**, last.
