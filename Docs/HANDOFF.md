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

**Last updated 19 Aug 2026, end of a very long live-testing session.** Build
**166** is installed on the owner's phone and confirmed off the device.

**Read the ledger's last Log entry before touching anything.** The session
ended with the storey screen reported as empty — no rooms drawing, moving
and connecting not working, photo upload erroring. All of those are reads
and writes against the API and are most likely ONE cause, probably an
expired session. It was not settled. Migrations **0037** and **0038** are
applied to production.
S5 is closed and verified, S6 has three of its four modes, and S8 went from
nothing to a working object system with a full illustration set — see the
ledger's Log, which carries the detail in order.
Builds 96 → 118 all shipped in that one session, each one installed and
most of them reported back on within minutes — the ledger's Log carries
them in order and is the real record.
The build number is stamped per install (`CURRENT_PROJECT_VERSION=NN`) and
`xcrun devicectl device info apps --device <udid> --bundle-id ca.renovisionana.crm`
prints what is actually on the device — use it. A whole session was once spent
arguing about a change that had shipped, because "installed" was assumed rather
than checked.

### Sections closed

**S1 room inspector · S2 wall inspector · S3 freehand affected areas ·
S4 affected-area parity · S11 commercial room types · S12's project half.**
`Docs/SECTIONS.md` is the ledger and carries the detail; this is only the
shape of it.

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
- **Affected areas**: the area inspector is the reference's three-tab sheet
  now, with Fill Color as a full matrix + `Reset`, `Show Dimensions` working
  on floor areas as well as walls, and photos and notes attached to the AREA
  rather than only its room. One shared row, `AffectedAreaRow`. **All of it
  compiled-only — nothing was tapped**; see S4's Verification note.

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
6. (18 Aug, S4) `FloorPlanView` aspect-fits its own Canvas, so it never
   occupies the space it is offered — and `AreaEditor` positioned its drag
   handles in the OFFER. Every handle sat a uniform 30–139pt off the corner
   it belonged to, worst when the plan's proportions differ most from its
   container's. Reported as an L-shape bug; a rectangle was worse.

**When a control "does nothing", check what it is SIZED as and what it is
COMPARED by before reading the handler.** Number 6 adds the corollary: **a
view that constrains its own size does not fill what it was offered, and an
overlay placed in the offer will not line up with it.**

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

**The next one is S5 — plan editor parity**, and most of 18 Aug was already
spent inside it without the section being formally opened: the canvas merge,
one-finger pan, the corner snap, the opening inspector, elevation dragging
and the unit fix all belong to it. Read S5's own **"State at handoff"**
block first — it lists what is genuinely left, checked against the code
rather than remembered, and it is short.

**S5 is DONE.** All four items shipped in **build 120** and confirmed on the
device by the owner — *"keypad opens it is good, the red numbers are there,
the rest is good."* The dimension-tap unlock, carried as unverified since
this file was written, is finally seen working. Items 2, 3 and 4 were: `Set Size` hides on a non-rectangular room
and comes back when it is square, ORD-31's live edge dimensions on the two
edges adjoining a dragged corner, and ORD-23's overall bounding extent on its
own outer line. **None of it has been looked at.**

**Next after S5:** S6, the photo editor, is under way — blur shipped alone in
build 121 and is unverified. See its own block in `SECTIONS.md`, including
the one thing that will bite: the new `DELETE /api/v1/photos` route does not
exist for the phone until the `mobile-app` branch is deployed, because the
app talks to the Vercel preview.

**ORD-23 moved the camera, so read S5's item 4 before touching the
viewport.** An outer dimension line needs space outboard of the walls and
there was none, so the standalone editor's fit inset grew and
`LevelCanvas.cameraBounds` now pads the focused room by 22% each side — in
METRES, as a fraction of the room, because `bounds` is what
`AnimatedStoreyViewport` interpolates and an inset changed at focus would pop
the base layer on the transition's first frame. Entering a room frames
slightly wider than build 118 did.

Anything the owner reports live outranks this list — that is how the whole
of 18 Aug went, and it worked.

## 6. Never verified on device

Both built and installed; neither confirmed by eye. Worth ten seconds each.

1. **Tapping a dimension number in the plan editor** should open the measurement
   panel with `Unlock`. The hit target was wrong twice — the string is drawn
   10pt beyond its dimension line, not on it. **Root cause found 18 Aug and
   it was neither of those:** the whole branch sat behind `if false` from an
   old bisect that was never closed, so it could not have worked. Re-enabled
   in build 112. Still unconfirmed by eye — and because dimensions are drawn
   OUTBOARD of the walls, a dimension tap that misses now falls through to
   "tap outside the room to leave", which is a visible, easy tell.
2. **Blank plan on the project card** — was a stale PostgREST schema cache and a
   `largest_room` embed falling back. Confirmed drawing 17 Aug — closed.
3. **Everything shipped in builds 113 → 118** and reported on only partly:
   detached-room Rotate, dragging an opening along its wall in elevation,
   Insert → Door or window from the elevation face, whole-floor project-card
   thumbnails with door arcs, the lighter default affected-area blue, and
   units following the operator's own setting everywhere.

**The device, not the simulator, is the test rig now.** The owner tests on
his own iPhone within a minute or two of each install, so build-and-install
is the loop: `CURRENT_PROJECT_VERSION=NN`, build, `xcrun devicectl device
install app`, then **read `CFBundleVersion` off the installed app before
claiming anything landed**. The phone drops to `unavailable` on his office
Wi-Fi for a minute or two at a time (AWDL — see §8); polling
`xcrun devicectl list devices` until it returns and retrying the install is
normally all that is needed, and `error 60` / `error 12040` on the first
attempt usually succeeds on the second.

**The simulator tool was unusable all of 18 Aug**: it reports "Xcode is
installed but not selected" although `xcode-select -p` prints
`/Applications/Xcode.app/Contents/Developer`. The fix is `sudo xcode-select
-s /Applications/Xcode.app/Contents/Developer` and it needs the owner's
password. It did not matter, because the device loop above is faster and
tests the real thing.

## 7. Open backlog

Filed as orders in `ORDERS.md` (**ORD-22 … ORD-42**). The ones that matter:

- **ORD-40** the illustrated object library, and **ORD-36** the objects model
  under it. This is now the single biggest visible gap against the reference:
  cabinets, toilets, mirrors, furniture. The obstacle is not the UI — it is
  that an object is not an opening. An opening lives IN a wall and deducts
  wall area; a cabinet sits ON the floor and deducts nothing, and the owner
  was explicit that a cabinet keeps its own height and stands on the floor.
  Nothing in the schema models that yet.
- **ORD-42** tap-and-hold Edit Layout — move and rotate a room in place. His
  own screenshot shows the mode. Note the gesture risk: the storey canvas
  already uses tap, one-finger drag and pinch, and one-finger pan was asked
  for by name, so a long-press must not steal from it.
- **ORD-41** animated capture-method illustrations.

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
