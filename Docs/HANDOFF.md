# Handoff — read this first, then `Docs/INDEX.md`

**Written 15 Aug 2026.** This file exists because work on this app is deliberately
split across **one chat per task**. A single long session carries its whole
history in context and every turn pays for it; a fresh chat per task is far
cheaper. So each chat starts here.

**Branch: `mobile-app`.** Everything below is committed and pushed. Working tree
was clean at handoff.

**Which task is yours: `Docs/SECTIONS.md`.** That is the ledger — every section,
its scope, what "done" means, and a copy-paste prompt. It also carries the rule
that matters most for keeping chats joined up:

> **Before your chat stops, update `SECTIONS.md`** — set your section's status,
> add a dated line to its Log, and write anything you learned into the later
> sections it affects. Commit that with the work. A chat that finishes without
> updating the ledger has cost the next chat the time it just saved.

---

## 1. What this app is

A native Swift iOS app for **Renovision AnA**, a Québec water-damage restoration
company doing **direct insurance work**. It replaces a Capacitor WebView wrapper
around a Next.js CRM. The phone talks to that same Next.js app over
`/api/v1/*` (cookie auth, `rv_admin`).

Two platforms hold the same geometry deliberately:

- **Swift** — `ios/App/App/Native/*.swift`
- **TypeScript** — `src/lib/**`, which the web app and the printed report use

**These are twins and must not drift.** Several files say so in their headers. A
figure that differs between phone and report is worse than one neither shows.

## 2. The owner's standing instruction — this governs everything

> *"I'm used to magicplan. For me to be able to test and confirm, I don't want to
> learn a new user interface. I want the exact copy of magicplan's interface.
> Every workflow, every button, everything needs to be in its original place. So
> I can actually test the function. When everything is tested and working, then
> we can make it our own."*

So: **match the reference exactly** — layout, button placement, screen order,
section order, gestures, wording, workflow. Do not improve, reorder, or
"rationalise" a screen. Muscle memory is the point.

**One narrow exception**, agreed with the owner: their icon artwork and 3D
renders are substituted with equivalents **in the identical position and role**.
Position and behaviour are what a hand learns; the glyph inside a button does
not change where you tap.

**Where the reference lives:** `Docs/reference/magicplan/object-model.md` is the
authority — observed on the owner's own device, values read off screen, gaps
marked as gaps. `editor-chrome-design.md` covers the plan-editor chrome.
`Docs/INDEX.md` says which document wins when two disagree.

## 3. Deliberate divergences — keep these, they are not bugs

| What | Why |
|---|---|
| **Damage cause** on an affected area (water / fire / mould / impact / other) | magicplan stores only a name + fill colour. Cause decides trade and rate here, and the DB constrains it. |
| **Drying log** — moisture readings, equipment in/out | magicplan has no equivalent. It is the drying record an adjuster needs. |
| **IICRC claim fields** on a project | Same reason. |
| **Our own imperial presets** (80″ door, 60″ double) | Theirs are metric. Ours are the North American stock sizes and correct for Québec. |
| **`{gross, net}` wall-area naming** | Their "walls with openings / without openings" is the reverse of intuition — "with openings" is the GROSS figure. Read the wrong way it is a 4 m² error on a small room. Never adopt their naming. |
| **Basement in the common floor set** | Their floor list files basements under "Other floors" — an appraiser's ordering. This trade lives in basements. |

## 4. State of the work

**Done and on the device** (see `git log`):

- Wall-closing fix — scanned walls that do not meet are cleaned, merged and
  welded before chaining, and a room that still cannot close says so instead of
  silently drawing its bounding box
- One fixed paper palette for every plan surface (a drawing does not invert in
  dark mode)
- Frozen editor viewport — the camera no longer chases an edit
- Sill height (`ORD-24`), baseboard length + measure definitions (`ORD-34/35`),
  room cards drawing the room (`ORD-26`), wall thickness + footprint figures
  (`ORD-33`), affected-area dimensions + room colour + floor moves
  (`ORD-32/37`)
- Affected-area editor rebuilt to the reference interaction: tap a point to
  select, red four-way handle, live edge dimensions, midpoint dots add corners,
  Delete-point appears with the selection, undo/redo, Cancel asks to discard
- `PlanTransform` — plan metres → canvas points in ONE place (it was written
  twice with different insets, which is why handles sat off their corners)

**Database:** migrations through **0031** are applied to production. Adding one
means writing it, then running it in the Supabase SQL editor — always ending
`notify pgrst, 'reload schema';`, or PostgREST serves a stale schema and the app
reports a column that exists as missing.

**Tests: 1120 passing** (`npx vitest run`). Swift has no test target, so
geometry is tested on the TypeScript side and mirrored into Swift by hand.

## 5. Next task

**See `Docs/SECTIONS.md`.** Sections are listed with status, dependencies, and the
files each one owns — that last column matters, because two chats editing the same
Swift file will collide.

At handoff the next one was **S1 — room inspector structure**: our tabs are
`Details | Damage & Drying | Photos & Notes`, the reference is
`Details | Photos & Notes | Forms` with damage as a section inside Details. The
owner's words: *"Damage and drying shouldn't be here. It should appear when we push
up more, and there we have to have add areas."* Full spec and observed layout are
in that section.

## 6. Two things never verified on device

Both built and installed; neither confirmed by eye. Worth ten seconds each.

1. **Tapping a dimension number in the plan editor** should open the measurement
   panel with `Unlock`. The hit target was wrong twice — the string is drawn
   10pt beyond its dimension line, not on it — so this needs a real look.
2. **Blank plan on the project card** — was a stale PostgREST schema cache and a
   `largest_room` embed falling back. Should be fixed; confirm a card draws.

## 7. Open backlog

Filed as orders in `ORDERS.md` (**ORD-22 … ORD-37**). The ones that matter:

- **Freehand affected areas** — the owner asked for finger-drawn shapes, any
  outline, not just dragged corners. magicplan has no such tool, so this is an
  additive divergence: keep the corner editor intact beside it.
- **ORD-23** overall bounding dimension line — needed once a room is not a
  rectangle
- **ORD-30** wall inspector: Load-Bearing, Display Elevation in Report, per-wall
  photos and notes
- **ORD-28** photo editor — **blur first**; it is the piece blocking real
  claim photos. Roughly two thirds is free from the SDK (`ColorPicker`,
  PencilKit, five Core Image filters); shape tools and the cropper are ours
- **ORD-22** commercial room types — take the Residential/Commercial split, NOT
  their list. Theirs is an office fit-out vocabulary; a flooded commercial
  building needs mechanical room, electrical room, server room, retail floor,
  warehouse bay, loading dock. Types must come from the owner's own jobs
- **ORD-36** objects takeoff · **ORD-25** Replace-with · **ORD-29** video/360
- **ORD-31** live edge dimensions — partly done in the area editor; the plan
  editor still lacks them
- Report parity: interleaved photo pages, locator thumbnail, `Only floors`
  layout untested

## 8. Working rules that have already cost time once

- **Verify a build reached the device.** `xcodebuild` piped through `grep error:`
  can print nothing and still have failed. Check for `BUILD SUCCEEDED`, and
  confirm the installed binary is fresh — Swift code lives in
  `App.app/App.debug.dylib`, **not** in `App.app/App`, so `nm` on the latter
  shows nothing and proves nothing.
- **Never claim something works because it compiled.** Two features shipped
  "done" this session and did nothing when tapped.
- **iPhone Mirroring and `devicectl` cannot hold the device at once.** Quit
  mirroring to install, reopen it to look.
- **The office Wi-Fi breaks AirDrop, mirroring and wireless debugging** — they
  all ride AWDL, which business networks block. It is not speed. Use a cable, or
  the owner's home network.
- **`developer disk image could not be mounted` means the phone is locked.**
- Merge conflicts in `project.pbxproj` are union-resolvable; run
  `python3 ios/App/check-project.py` after, and `add-sources.py` when adding a
  file.
