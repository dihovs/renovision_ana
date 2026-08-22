# Custom objects — how an operator adds a thing the catalogue has never heard of

**Status: BRAINSTORM, nothing built.** Written 22 Aug 2026 at the owner's ask,
after scanning his own condo:

> *"I wanna be able, when we're detecting an object that's not in our gallery, to
> create this object. Maybe use… I don't know. Let's say it's a baby chair, or
> something that doesn't exist but this particular house has. We need to create
> it, but I don't know. Think about it, do a brainstorm and let me know."*

Read `Docs/SECTIONS.md` S8 for what the object system already is. This document
proposes; it decides nothing. **Three questions at the bottom need his answer
before any of it is built.**

---

## 1. The two cases are different, and only one of them is hard

**Case A — the scanner found something and could not name it.** RoomPlan
returned `.storage`, or a low-confidence guess, and `ScanCatalogue.read` already
hands back `(nil, "Storage", true)` — the question-mark case the owner asked for
back in June. **The object's measured bounding box is already in hand.** Width,
depth, height and position are known to the centimetre because the LiDAR
measured them.

**Case B — nobody found it at all.** The operator is looking at a thing the scan
missed entirely and the catalogue does not carry. Nothing is known about it.

These want different flows, and conflating them is the main way this gets built
wrong. **A is the common case and is nearly free**, because the expensive part
of describing an object — its size — is the part already solved. B needs a form.

## 2. The crux: the catalogue is compiled, a custom object is data

`ObjectCatalog.entries` is 304 hard-coded Swift values and the artwork is 355
compiled asset-catalogue images. Nothing in that pipeline can grow at runtime.
So a custom object cannot BE a catalogue entry — it has to be a second source
the picker merges in.

That is the whole architectural question, and everything below is a way of
answering it.

## 3. The line worth holding

**Anything that changes the claim's arithmetic stays curated. Anything that is
only a line item can be operator-made.**

An **opening** deducts `width × height` from net wall area (`wallAreaNetSqm`),
so a wrong custom window silently shrinks the drywall figure the claim is priced
from. An **object** deducts nothing — it stands on the floor and carries its own
height, by the owner's own instruction — so a wrong custom object is a wrong
line, visible on the takeoff, arguable, and fixable. One is a quiet error in the
money; the other is a loud error in a list.

**So: custom OBJECTS yes, custom OPENINGS no.** The five windows and the double
bifold added on 22 Aug are the right way to grow the opening set — curated, with
stated inch derivations. This is also the answer to "why can't I just make a
window too", which he will reasonably ask.

## 4. Three shapes it could take

### Option A — a real custom catalogue, server-side

New table `custom_objects`, scoped to the company rather than the project:
`slug, name, category, width, depth, height, shape, created_by`. The picker
fetches and merges them with the compiled entries.

- **For:** create "baby chair" once and it exists on every job forever. The
  library grows from real work, which is exactly how the 304 got here.
- **Against:** a migration, an API, merge logic, a create screen, and a sync
  story — before anybody knows whether he will place a second one.

### Option B — a per-project one-off

Place a generic object and give it a name. `room_objects` already carries
`quantity`, `included`, `disposition` and a foreign key; this needs roughly one
free-text `custom_name` column and no new table.

- **For:** cheapest by a wide margin, and it matches his actual words —
  *"something that doesn't exist, but this particular house has"*. A one-off in
  one house is exactly what this is.
- **Against:** nothing accumulates. Type "baby chair" again next year. And the
  takeoff groups by slug, so every custom collapses into one row unless it
  groups by name instead.

### Option C — B first, then promote. **Recommended.**

Create it as a one-off, in the flow, in about four taps. Then a quiet
`Save to library` on the object's own detail sheet turns it into an Option-A
entry when it turns out to be a thing he places more than once.

- The moment of creation is mid-scan in somebody's laundry room. That is the
  worst possible moment for a library-management form.
- The promotion moment already has every field a library entry needs — name,
  size, category — so it costs one button, not a second screen.
- It defers the expensive half (table, sync, sharing across the crew) until
  there is evidence it is wanted, which is the same reasoning that kept
  favourites in `UserDefaults` instead of a table.

## 5. What the flow actually looks like

**From a detection (Case A)** — the strong one, and specific to this app:

1. Scan surfaces an unknown: *"Something here — 0.45 × 0.40 × 0.85 m."*
2. `Name it` → text field, with the synonym-aware search offering existing
   entries first, so "high chair" finds a catalogue chair before inventing a
   duplicate.
3. Nothing matches → `Create "Baby chair"`.
4. Category picker (the fourteen that exist) and one of the dozen `Shape`
   outlines. **Dimensions are pre-filled from the scan and not typed at all.**
5. It is placed, included, and on the takeoff.

**From nothing (Case B)** — the same sheet with the dimensions empty and
sensible defaults, reached from the picker as a `+ Create object` row pinned at
the bottom of search results when nothing matched. That placement matters: the
moment you learn the catalogue lacks something is the moment the search comes
back empty, and that is where the offer belongs.

## 6. Artwork must never block this

A custom object gets no illustration, and that is fine. `ObjectCatalog.Shape`
already carries a dozen outlines and the file's own comment says a dozen covers
a catalogue of any size, "because what makes a toilet readable on a plan is its
outline, not a portrait of it". `LibraryArt` already falls back to a drawn
symbol when an asset is missing — `windowPicture` and the new
`doorBifoldDouble` both do it today.

So: the operator picks an outline, the plan draws the outline plus the name.
Honest, immediate, and no dependency on commissioning a drawing.

## 7. What this must not break

- **Takeoff grouping.** `countByKind` and the Objects tab group by slug. A
  custom needs a stable identity — a generated slug like `custom_baby_chair`,
  not a display string — or two spellings become two rows.
- **The report.** A custom object prints like any other. Its name is
  operator-typed and goes in front of an adjuster, so it wants the same
  trimming and empty-guard the room-name field already has.
- **Language.** The report has a French mode; an operator-typed name has no
  translation and must print verbatim in both, not be run through a lookup that
  silently blanks it.
- **Deletion.** If a promoted library entry is deleted, objects already placed
  from it must keep working. Store the size ON the placed object, not only a
  reference to the definition.

## 8. Questions only the owner can answer

1. **Does a custom object need to reach the rest of the crew**, or is it enough
   that it exists on the phone that made it? This is the single biggest cost
   fork — sharing means the server table, and not sharing means `UserDefaults`.
2. **Should a custom carry a price or trade code**, like the disposition flags
   do? If a custom is going to be estimated, it needs more than a name and a
   box, and that changes the create sheet.
3. **One-off first, or library first?** §4 recommends one-off-then-promote. If
   he would rather every custom go straight into a shared library, that is a
   legitimate different answer and it changes the build order.
