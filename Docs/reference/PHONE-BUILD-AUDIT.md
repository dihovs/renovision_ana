> ## ⚠️ STALE — read `Docs/REFERENCE-STATUS.md` instead
>
> This audited the **shipped phone build** by walking the app's UI. The source is ahead of it.
> Ten claims here are wrong: dimension locking is fully built, living area is implemented end
> to end, 3D exists, project filters and archive exist, project detail has floors/files/report,
> and the "missing table" banner also fires on a failed embed (`PGRST200`), so the blocker may
> be a stale schema cache rather than an unrun migration.
>
> Kept for the screenshots and the UX comparison, which remain valid.

# RenoVision — state of the build, audited 14 Aug 2026

Walked the shipped app on device via iPhone Mirroring and compared it against the magicplan
reference in `docs/magicplan/`. Screenshots in `screens/`.

**Headline:** further along than the planning docs assumed, and pointed at a different product.
There is also **one live blocker** stopping any scan from persisting.

---

## 0. Fix this first — the backend is broken

`phone-build-screens/rv-13-project-detail-errors.jpg` shows a red banner on every project:

> *"The `room_scans` table is not reachable — run the migration in supabase/migrations, or
> reload Supabase's schema cache. Database said: Could not find the table `public.room_scans`
> in the schema cache"*

Directly beneath it, an orange banner:

> *"1 room waiting to upload — Measured with no signal and held on this phone. They send
> themselves as soon as you have a connection — nothing to do. · Room 1 — Ground"*

Consequences visible on the same screen: `FLOOR 0 sq ft`, `WALLS 0 sq ft`, `ROOMS 0`, and
*"Nothing measured yet"* — despite a measured room existing locally.

So: **rooms are captured, queued, and never land.** The offline queue is doing its job; the
table it wants does not exist. Nothing downstream — living area, equipment billing, the PDF —
can work until the migration is applied.

The queue message is also misleading. It attributes the failure to *"no signal"* when the real
cause is a missing table. That will send you hunting the wrong problem.

**Actions:** run the pending migration in `supabase/migrations`, reload the schema cache,
flush the queue, and make the offline banner distinguish "no connection" from "server rejected
the write".

---

## 1. What RenoVision actually is

Not a magicplan clone. It is a **restoration-contractor field app** — the business is the
product, the floor plan is one input.

Evidence from `phone-build-screens/rv-01-home-today.jpg` and `rv-13`:

- Tab bar: **Home · Projects · Customers · Estimates · Scan**
- Home surfaces `ACTIVE JOBS`, `ROOMS`, **`DRYING`**
- Projects carry **Equipment**: *"Air movers and dehumidifiers bill per unit per day. Logged
  when they land, they bill themselves."*
- Project detail ends in **"Report — make and send the PDF"**

Drying days and per-unit equipment billing are water-damage restoration mechanics. This is
much closer to magicplan's actual commercial positioning (the Claim Details field group,
Fire and Safety / Restoration object categories) than to the "personal tool" scope in
`MVP.md`.

**`MVP.md` is now wrong** and should be re-scoped. It assumed a single-user personal tool with
no customers, no estimates, no billing. Keep it as a record of the reasoning; do not build to it.

---

## 2. Screen-by-screen against the reference

| Area | RenoVision | magicplan reference | Verdict |
|---|---|---|---|
| **Home / Today** `rv-01` | Date, greeting, today's schedule, quick actions (Scan a room / Phone / Messages), business stats | No equivalent — magicplan opens on a project list | **Ahead.** A daily-driver home screen is better for field use. |
| **Projects list** `rv-02`, `rv-12` | Search, stats bar (Projects/Rooms/Active), rows with client + `NOT MEASURED` chip, FAB | Grid cards, filter chips (All/Favorites/Archived), overflow menu per card (INT-P02, INT-P05) | **Behind.** No filters, no per-row actions, no archive. The `NOT MEASURED` status chip is a good idea magicplan lacks. |
| **Project detail** `rv-13` | Stats (Floor/Walls/Rooms), Living Area placeholder, room list, Equipment, Report | Sectioned: address, statistics tiles, floor plans rail, photos, files (INT-P09…P12) | **Behind on structure**, ahead on domain — Equipment has no magicplan analogue. No photos, no files, no floor concept surfaced. |
| **Customers** `rv-03` | Empty, search + FAB | Not present | **Ahead** — magicplan has no CRM. |
| **Estimates** `rv-04` | Empty, FAB | Not present | **Ahead.** |
| **Scan entry** `rv-05` | "Which property?" → project picker | `Insert → Room → method chooser` inside the floor editor (INT-S01) | **Different, arguably better.** Scan is a top-level tab, two taps from launch. magicplan buries it four levels deep. |
| **Add a room** `rv-06` | One screen: floor picker (Basement/Ground/2nd/3rd/Attic) + method (`Scan the room` / `Draw it instead`) | Three screens: Add Floor sheet → method chooser (5 options) → room type (INT-S01, INT-S12) | **Ahead on flow.** One screen replaces three. Fewer methods, but the two that matter. |
| **Draw a room** `rv-07` | Width / Length / Ceiling height fields, live `120 sq ft`, hint *"Feet and inches — type 13' 6, or 12.5"* | `Add Square Room` drops a fixed 2.5 m square, then `Set Size` (INT-E08) | **Ahead.** Entering real dimensions up front beats resizing a default square. |
| **Shape editor** `rv-08`, `rv-09` | Rectangle with corner handles, per-wall dimension labels, wall selection, `Type length` / `Add corner`, live area. Hint: *"Tap a wall to move it, or a corner to drag it."* | Full editor: corner drag, Edit Layout move/rotate, padlocks on manual dimensions (INT-E10…E14) | **Partial.** Core geometry editing works. Missing: locked-vs-derived dimension provenance (no padlock), room move/rotate, multi-room shared walls. |
| **Wall length entry** `rv-10` | Sheet: "Currently 12'-0"", text field, `Apply` | `Change Measurement`: custom numeric keypad, wall-by-wall `Next`→`Apply`, live preview, laser input (INT-E09) | **Behind, and this is the one to fix.** System keyboard vs purpose-built pad. No sequential walk. No live preview. |
| **Room measured** `rv-11` | Stats card (Floor/Perimeter/Ceiling), `4 walls · 0 doors · 0 windows`, name field, 8 type chips, `Save room` / `Scan again` | `Review Scan` + separate `Select Room Type` sheet (INT-S09, INT-S12) | **Ahead.** One screen merges review, naming and typing. `Scan again` is the reject path magicplan puts on a second screen. |
| **Objects** | None found | 666 objects, 14 categories, wall snapping, inspector (INT-E20…E28) | **Missing.** `0 doors · 0 windows` in `rv-11` implies the model has slots but nothing places them. |
| **Export** | "Report — make and send the PDF" (not opened) | Five export types, per-type settings, page layout, title block (INT-P24…P33) | **Unknown.** Entry point exists. |
| **3D / Elevation** | None found | 3D read-only, wall elevation with ← → steppers (INT-S18, INT-S19) | **Missing** — correctly deferred. |
| **Settings** | `···` top-right, not opened | Units, AR scan mode, sync, cache (INT-P34, INT-P35) | **Unknown.** |

---

## 3. Where RenoVision is genuinely better

Do not regress these while chasing the reference:

1. **Scan is a top-level tab.** Two taps from launch versus magicplan's four levels.
2. **One "Add a room" screen** instead of three sheets.
3. **Real dimensions up front** rather than resizing a 2.5 m default.
4. **"Room measured" merges** review + naming + typing into one screen.
5. **A Today screen.** magicplan has no daily view at all.
6. **`NOT MEASURED` status chips** on project rows.
7. **Imperial-first with a smart hint** (`13' 6` or `12.5`) — correct for the North American
   restoration market. magicplan buries units in a settings wheel.

---

## 4. Ranked gaps

**Blocking**

1. `room_scans` migration — nothing persists (§0).
2. Offline banner misreports the cause.

**High value**

3. **Wall-length entry** — replace the system keyboard with a numeric pad, add sequential
   wall-by-wall `Next`→`Apply` with live preview. Reference: `magicplan/screens/38-change-measurement-panel.jpg`, INT-E09.
4. **Dimension provenance** — no locked-vs-derived distinction, so there is nothing to drive
   "only manually-set dimensions" in a report. Reference: `44-manually-set-dimension-padlock.jpg`, INT-E12.
5. **Doors and windows** — `rv-11` counts them, nothing creates them. Even four door types and
   three window types would make plans legible.
6. **Verify the measurement formulas.** `rv-11` reports Perimeter 44 ft for a 12×10 room —
   that is the ceiling perimeter, `2×(12+10)`. Check whether wall area uses the **ground**
   perimeter as it must (`docs/magicplan/spec.md` §3, `PLAN.md` STEP 07). This is silent-wrong
   territory.

**Medium**

7. Project detail structure — floors, photos, files.
8. Projects list filters and per-row actions.
9. Scan-time feedback — the mini-map (INT-S04) and incompleteness warning (INT-S07). Unknown
   whether the camera path has these; blocked from checking (below).

**Low** — 3D, elevation, object catalogue beyond openings, statistics screen.

---

## 5. Not verified

- **The camera scan path.** `Scan the room` was not exercised — iPhone Mirroring blocks camera
  access. Everything about the live scan HUD in RenoVision is unknown. **This is the biggest
  hole in this audit**; needs a screen recording like the magicplan one.
- **Report / PDF output** — entry point only.
- **Settings** behind the `···`.
- **Customers and Estimates** beyond their empty states.
- **Corner dragging and `Add corner`** — controls seen, behaviour not exercised.

---

## 6. Correction to the magicplan docs

`docs/magicplan/interactions-scan.md` open question 6 flagged an *[uncertain]* screen headed
"NAME THIS ROOM" with room-type chips and `Save room` / `Scan again`, seen as a Photos
thumbnail, and speculated it might be an older magicplan build.

**It is RenoVision's own "Room measured" screen** (`phone-build-screens/rv-11-room-measured.jpg`). Not
magicplan. That uncertainty is resolved and the speculation should be struck.
