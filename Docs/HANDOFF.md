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

**Read the text, not the pictures.** `Docs/reference/CAPTURE-PROTOCOL.md` explains
why: an image costs far more than the fact it carries, and it is re-sent with
every later message until the history compacts. `spec.md` §9 indexes all 106
screenshots by description, so you can usually get what you need without opening
one. `gallery.html` lays them all out **for the owner** — a human reads pictures
better than prose; an agent reads prose far cheaper than pictures.

If you must capture something new, read the protocol first. It has the cheap
routes: the app's own PDF exports read as text with PDFKit, their public help
centre, and the database — each of which beat screenshots on both cost and
clarity during the review.

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

**Last updated 18 Aug 2026.** Build **95** is installed on the owner's phone.
The build number is stamped per install (`CURRENT_PROJECT_VERSION=NN`) and
`xcrun devicectl device info apps --device <udid> --bundle-id ca.renovisionana.crm`
prints what is actually on the device — use it. A whole session was once spent
arguing about a change that had shipped, because "installed" was assumed rather
than checked.

### Sections closed

**S1 room inspector · S2 wall inspector · S3 freehand affected areas ·
S11 commercial room types · S12's project half.** `Docs/SECTIONS.md` is the
ledger and carries the detail; this is only the shape of it.

- **Project grid**: the reference's `All / Favorites / Archived` chips
  (Archived is its own server query, and the only way back from an accidental
  archive), per-card ⋯ menu `Favourite · Move · Duplicate · Archive…`, star
  badge, and a workspace row showing real pending-upload state.
- **Project page** in the reference's order: description → address → Forms →
  Statistics 4-up + See All → Floor Plans → Photos → Files → Created / Last
  modified. Plus `Project Info` behind the pencil, the title-bar menu, and the
  `Export Floor Plans` sheet behind share.
- **Project Location**: a real map picker — Apple's address search, a fixed
  centre pin the map slides under, reverse geocoding to read the address off
  the map. MapKit needs no key and no quota.
- **Floor canvas**: choosing a floor opens the storey itself — drafting grid,
  undo/redo, floors and 2D steppers, `+ Insert`, swipe-up for the floor
  inspector. Insert offers Room · Object · Note · Photo · Form.
- **Add Room**: Auto-Scan, Add Square Room and **Draw Room** (place corners one
  tap at a time, new `DrawRoomView.swift`). The two scan cards carry our own
  isometric illustrations, drawn not traced.
- **Select Room Type**: Residential / Commercial, with their sixteen commercial
  types plus the ten this trade needs (mechanical room, warehouse bay, loading
  dock…). Commercial reports no living area — Z765 measures a dwelling.

**Scanning is no longer a destination.** The Scan tab and the floating Scan
button are gone at the owner's instruction; a scan starts from the + in a
project's Floor Plans rail, which is where the reference starts one.

### Earlier work, still standing

Wall-closing fix; one fixed paper palette; frozen editor viewport; sill height
(`ORD-24`), baseboard length + measure definitions (`ORD-34/35`), room cards
drawing the room (`ORD-26`), wall thickness + footprint (`ORD-33`),
affected-area dimensions + room colour + floor moves (`ORD-32/37`); the
affected-area editor rebuilt to the reference interaction; `PlanTransform` —
plan metres → canvas points in ONE place.

### The bug family this session kept finding

Five separate reports of "it does nothing" were all **a screen unable to show
or receive what was already true**. Worth recognising on sight, because none of
them look like bugs in the code that owns the feature:

1. `ProjectSummary.==` compared ids only, so SwiftUI correctly refused to
   redraw a card whose star had changed. Every write had succeeded.
2. `URLSession` sat on the default cache policy, which will serve a stale GET.
3. The New Project tile was drawn with `strokeBorder`, which fills nothing —
   only its 1.5pt outline took a tap.
4. The floor canvas's pan was attached to a layer sized to its content, so an
   empty floor had almost nothing to grab.
5. An oversized grid plate as a ZStack sibling made the stack 2400pt tall and
   pushed the action bar off-screen.

**When a control "does nothing", check what it is SIZED as and what it is
COMPARED by before reading the handler.**

### Database

Migrations through **0036** are applied to production — 0035 (`assigned_to`,
`is_favorite`) and 0036 (`address_line1/city/postal`) landed this session.
Adding one means writing it, then running it in the Supabase SQL editor —
always ending `notify pgrst, 'reload schema';`, or PostgREST serves a stale
schema and the app reports a column that exists as missing.

**The SQL editor can be driven from here.** The owner is signed into Supabase
in Chrome, so a migration can be applied with the browser tools rather than
handed over as a chore: project `renovision-ana`, SQL Editor, paste, Run. Wait
for the editor to finish loading before typing — clicking too early lands
keystrokes on the page and navigates away.

**Tests: 1120 passing** (`npx vitest run`). Swift has no test target, so
geometry is tested on the TypeScript side and mirrored into Swift by hand.

### Two traps that cost time this session

- **Type-checker timeouts.** Four generic closures on `CardGrid`, or
  `CollectionShell`'s three trailing closures inside a `ForEach` inside a
  `ScrollView`, put the expression past what Swift will solve. The fix is to
  name the sub-expression — `projectGrid`, `storeySection`, `openingsCaption`
  are all extractions for exactly this.
- **A new Swift file must be registered**: `python3 ios/App/add-sources.py
  Native/YourFile.swift`, then `check-project.py`. It is not automatic.

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
- **A `nil` in a Swift PATCH body does not reach the server.** Synthesised
  `Encodable` uses `encodeIfPresent`, so an optional that is nil OMITS its key
  — and every `/api/v1` route here reads an absent key as "this field was not
  mentioned". Clearing a room's colour or its type silently did nothing for
  weeks because of it. Use `API.NullablePatch`, which encodes real `null`.
- **iPhone Mirroring and `devicectl` cannot hold the device at once.** Quit
  mirroring to install, reopen it to look.
- **The office Wi-Fi breaks AirDrop, mirroring and wireless debugging** — they
  all ride AWDL, which business networks block. It is not speed. Use a cable, or
  the owner's home network.
- **`developer disk image could not be mounted` means the phone is locked.**
- Merge conflicts in `project.pbxproj` are union-resolvable; run
  `python3 ios/App/check-project.py` after, and `add-sources.py` when adding a
  file.
