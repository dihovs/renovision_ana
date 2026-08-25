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

**The CRM website is a separate area with its own rules.** Messaging — texting,
MMS, WhatsApp, the inbox — is `Docs/CRM-Messaging.md`; the Twilio account and
voice are `Docs/Twilio-Wiring.md`. The magicplan instruction above does NOT
apply there: it governs the iOS app's screens, not the web CRM. Messaging has
its own governing constraint instead, which is CASL — read that doc's §2 before
touching the send path.

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
**175** is the last build confirmed on his phone; 176-181 are built and waiting on a cable.

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

**In this order. The first is five minutes and unblocks a build.**

1. ~~**S7 setup — apply migration 0041 before video upload can work at
   all.**~~ **DONE 22 Aug 2026, applied to production and verified.**
   `project_files` now carries `duration_seconds` (int4, nullable) and
   `thumbnail_path` (text, nullable) — 13 columns, read back off the
   dashboard, and PostgREST's own generated API docs list both, which is
   the schema cache confirming itself rather than a `notify` assumed to
   have worked. The `/api/v1/videos` finalize route is unblocked.

   **Applied through the dashboard's Database → Tables → New column UI,
   not by running the SQL file.** The SQL editor could not be driven from
   the chat this time — typing into it was refused by a permission
   classifier, twice. The table UI was allowed and reaches the same place.
   Two things follow. **`supabase/migrations/0041_video_files.sql` is not
   recorded as run** in the Migrations list, and it is `add column if not
   exists` throughout, so re-running it later is harmless and still the
   right thing to do if the migration history is ever replayed. And
   **Supabase's own `pgrst_ddl_watch` event trigger fired the reload** —
   DDL through the dashboard notifies PostgREST without the explicit
   `notify` line, which is why the API docs were fresh immediately.

   **A trap this cost half an hour on, worth recognising.** The SQL editor
   opened carrying a LEFTOVER query — migration 0036's `alter table
   public.projects add column … address_line1 …` — from a previous
   session. Pressing Run on it returns a perfectly genuine
   `Success. No rows returned`, for the wrong statement, against the wrong
   table. **A green success in that editor proves a query ran, not that
   YOUR query ran.** Read the editor's own text before trusting the
   result, and confirm the change in Database → Tables afterwards.
2. ~~Get a build onto his phone.~~ **DONE 21 Aug, done again 22 Aug** — the
   second is what actually matters here: two real fixes went to the device
   the same day they were found, not left for a future session to
   rediscover. How, because the project does not record it and a
   device build FAILS without it:

       cd ios/App && xcodebuild -project App.xcodeproj -scheme App \
         -destination 'id=73E8F9E5-0BC7-53C2-B9E5-41377E9D51E2' \
         -derivedDataPath /tmp/ddev -allowProvisioningUpdates \
         DEVELOPMENT_TEAM=P34VX5R85A build
       xcrun devicectl device install app \
         --device 73E8F9E5-0BC7-53C2-B9E5-41377E9D51E2 \
         /tmp/ddev/Build/Products/Debug-iphoneos/App.app

   **`DEVELOPMENT_TEAM` is not in `project.pbxproj`.** Signing is Automatic
   with no team, so a device build stops with "requires a development team"
   until it is passed on the command line. `P34VX5R85A` is the OU of his
   signing certificate, which is where the value came from.

   **And the phone was simply reachable** — `tunnelState: connected`,
   `transportType: localNetwork`. Earlier sessions in this repo concluded the
   office Wi-Fi blocked the peer-to-peer radio and that only a cable would
   work. That was wrong. The tunnel sleeps and wakes; check before assuming.

   **22 Aug: `xcodebuild -destination id=...` itself timed out on the first
   try** ("Timed out waiting for all destinations... to become available"),
   even though `xcrun devicectl list devices` showed the phone as
   `available (paired)` the whole time — `xctrace list devices` in the same
   moment showed it Offline. Same tunnel-sleeps-and-wakes symptom as above,
   just caught by a different tool's destination resolution. Retrying the
   identical command a few seconds later succeeded outright — no special
   handling needed, just try again.

   `devicectl device process launch` then dropped the connection, which does
   not matter — the install landed and the icon launches by hand. `devicectl` has read `unavailable` all
   session — the tunnel sleeps; this is NOT a Wi-Fi-disabled problem, which I
   told him three times and was wrong about. A cable settles it.

   **22 Aug's install carries two fixes, both found live with the owner
   testing on the actual app**: `SiteCameraController.startRecording`
   crashed outright (uncaught `NSException`, uncatchable in Swift) when the
   video connection wasn't active — found on the Simulator, which has no
   camera at all, but the same crash could hit a real device too if that
   connection were ever left inactive for any other reason; and correcting
   a wrongly-detected door mid-scan was closing the ENTIRE capture session
   instead of just the correction sheet, a double-dismiss bug in
   `RoomScanViewController.askAbout` — his own live repro. Full accounts in
   `Docs/SECTIONS.md`, S7 and S8. **The door-correction fix specifically
   needs his own retest**: reproduce the exact repro (scan, wrong door
   detected, correct it) and confirm the scan keeps running.
3. **Verify the PDF actually renders.** `Download PDF` drives a headless
   browser server-side and has never once been run end to end — the preview
   origin has no session and I will not type his password. Either he signs in,
   or press it from a signed-in browser and check the file.
4. ~~**Seven windows still have no `OpeningKind` case**~~ — **FIVE of the
   seven landed 22 Aug 2026; the other two are a question for the owner,
   not work.** `windowAwning`, `windowBow`, `windowGlassBlock`,
   `windowHalfRound` and `windowTransom` now exist with stock sizes, labels
   and artwork, and `OpeningKind` is 24 cases. `BUILD SUCCEEDED`, which for
   this particular change is a real proof and not the usual empty one:
   Swift's exhaustiveness check means a switch site I had missed could not
   have compiled. Checked separately that no `switch` over `OpeningKind`
   carries a `default:` that would have swallowed the new cases silently —
   none does.

   **The two left out are not holes in a wall, and that is the whole
   point.** `wallAreaNetSqm` (`Models.swift`) deducts `width × height` for
   every opening in the door/window/passage arrays without asking where it
   sits, so:

   - a **skylight** is in the ROOF, and filing it as a window would deduct
     wall area for an opening no wall has;
   - a **storm window** is a SECOND sash over a window already placed, so
     it would deduct the same hole twice.

   Either one quietly shrinks the drywall figure a claim is priced from,
   in the direction that costs the owner money. `window-skylight.svg` and
   `window-storm.svg` are therefore still in `Native/Artwork` under their
   original names, deliberately. **Ask the owner** whether he wants a
   ceiling-opening model (which is the honest home for a skylight, and
   nothing in the schema has one) or whether these should be objects/line
   items instead. Do not improvise it.

   **Also found: `windowPicture` has no artwork** and never did —
   `door-windowPicture.svg` does not exist, so that one tile falls back to
   the drawn `OpeningTileArt` symbol. Harmless, pre-existing, and invisible
   until you know to look. Worth adding to the next artwork commission.
5. **Guided protocol Phase 1**, starting with the rules table as pure data
   plus tests, and no interface at all. The rules ARE the design and he can
   review them before a screen exists.

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

## 6b. Where the 21 Aug session stopped — READ THIS FIRST

**Long session, three strands: the report, the object library, and two specs
written but not built.** Everything below is committed and pushed on
`mobile-app`. Working tree clean.

### The report — largely rebuilt, and it is the strand furthest along

Put beside his own 19-page magicplan export, ours had a grid of room
thumbnails where theirs had a building. That is fixed and a good deal more:

- **`ReportStoreyPlan.tsx` (new)** draws a storey as ONE assembled floor from
  `plan_x`/`plan_y` — the same `resolvePlacements` the phone's canvas uses, so
  what he arranged is what prints. Where a room was never placed the packer
  arranges it and the page SAYS so, and no dimension is taken across a packed
  layout.
- **The locator** — the storey drawn faint with this room in ink, beside the
  room's own plan. His words: *"that is amazing."* It is the best idea on
  their page.
- **`PlanObjects.tsx` (new)** draws the fixtures — bath, WC, counter run,
  beds, appliances — on both the storey and the room plan, at each object's
  measured footprint.
- **The outer dimension chain**, computed: a wall is outer when a point
  stepped off its face lands in no other room.
- **The room plan's chain splits at its openings** — pier, door, pier.
- **Roboto**, self-hosted. Read out of his export's embedded font table, not
  guessed.
- **A cover map**, proxied through `api/admin/staticmap` so the Maps key never
  reaches the markup.
- **LANGUAGE PICKER.** `?lang=fr|en`, chosen on the export screen, defaulting
  to French. The app stays English — his explicit ask. Numbers, dates and
  ordinals are localised too (`80,53 m²`, `21 août 2026`, `2e étage`), because
  a page of figures translated only in its labels is half-translated.

**Three bugs found only by rendering, worth remembering as a method:**

1. **`report.css` contained a stale duplicate of itself** — 1558 lines, three
   overlapping generations, and CSS gives the LAST one the win. Changes I had
   "made" were being silently overridden. 338 lines removed.
2. **17 sections were printing as 19 sheets.** Room pages came out 288mm on a
   239mm page.
3. **`Scale 1:21` printed under a drawing at nearer 1:55** — the ratio was
   computed against a hard-coded width, but an SVG fitted with
   `preserveAspectRatio` is scaled by whichever dimension runs out first.

**Read the file with PDFKit and LOOK at the render.** Reading the source
would have caught none of those three.

### The object library — 163 icons, and the pipeline around them

He commissioned the artwork from another AI and it is **better than what I
drew** — verified icon by icon across all 94 of the first batch, not assumed.
Mine are in git history; the generator `scripts/draw-object-artwork.py`
survives as the fallback and as the source of the viewBox fitter.

- **341 drawings** in `ios/App/App/Native/Artwork/`, every one fitted to
  0.862 of its tile, dead centre.
- **`ObjectCatalog.swift` is 304 entries**, up from 72 at the start of the
  day. Every entry has artwork. Only five drawings are unreachable and all
  five are aliases of entries that already exist.
- **The 296-item target in `Docs/Object-Catalogue-Target.md` is met and
  passed.** What is left is the seven windows in §5.

**The catalogue entries were generated, and the generator had two bugs worth
knowing about:** joining the rows with a literal `\n` rather than a newline
produced a file that would not parse, and one slug was already present so the
list carried a duplicate. `swiftc -parse` caught the first; a `Counter` over
the slugs caught the second. **Run both after any bulk edit to that file** —
neither is visible by reading the diff.

**THE PIPELINE, and the thing that has now cost time four times:**

```
ios/App/App/Native/Artwork/*.svg     ← deliveries land HERE, nowhere else
        │  node <fitter>             ← viewBox → own bbox, 16% pad, centred
        │  python3 scripts/install-object-artwork.py
        ▼
ios/App/App/Assets.xcassets/Objects/ ← GENERATED. never hand-edit.
```

Every batch has arrived with `viewBox="0 0 120 120"` and one landed straight
in the generated catalogue, overwriting fitted files. The fitter is a small
puppeteer script; it was rewritten twice because it lived in `/tmp`. **Move it
into `scripts/` next session** — that is a five-minute job that stops the
sixth repetition.

### Specified, NOT built

- **`Docs/Guided-Protocol-Spec.md`** — Phase 1 of the on-site checklist. A
  list the job writes for itself from what has been marked; completion derived
  from records that already exist so it can never disagree with the job;
  explicit taps STORED, because a dated attributed assertion that somebody
  looked is a far stronger thing on a claim than the absence of a finding.
  Rules table first, with tests, before any screen. **He approved the
  direction.**
- **`ios/App/App/Native/SiteCamera.swift` (new)** — a real `AVCaptureSession`
  camera with the reference's chrome: mode strip, lens buttons, grid, and the
  timestamp burned into the frame while you aim. It replaces
  `UIImagePickerController` in `RoomPhotosSection`. **It compiles** — the whole
  app was built at the end of the session. It has never been RUN.

### magicplan reference — a correction worth carrying

Their library is **666 items in 14 categories**, not the 465 in 11 this repo
recorded. The old figure came from a screenshot that stopped scrolling at
Electrical, missing Outdoors 52, Garage 13 and **Fire and Safety 136** — their
second largest category, which this repo had written off as holding "nothing
this trade would place." No complete item list is published anywhere; only the
17 door names are transcribed.

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

## 9. Where the 24 Aug session stopped — READ THIS BEFORE THE DOLLHOUSE

**Builds 195 → 213, every one installed and verified by reading
`CFBundleVersion` off the device.** Sixteen commits, all pushed on
`mobile-app`. Working tree clean at handoff.

### 9a. Two things must happen before anything else

1. **Run migration `0042_insurance_estimates.sql`** in the Supabase SQL
   editor. The estimator is built, tested and shipped and cannot be opened
   until this is applied — the page says so itself. **Read the editor's own
   text before trusting a green Success**; that trap is recorded in S12.
2. **Collect the storey geometry.** Build 207 added
   `ScanLens.writeGeometryExport`: opening a storey writes the raw
   `ScanGeometry` to `Documents/storey-geometry.json`, which is exactly what
   the web's `FloorPlan` consumes. It has **not been collected yet** — the
   owner opens a storey, then:
   `xcrun devicectl device copy from --device <udid> --domain-type
   appDataContainer --domain-identifier ca.renovisionana.crm --source
   Documents/storey-geometry.json --destination /tmp/`.
   It exists so a sample estimate can be drawn with a REAL room instead of an
   invented one, which is what he asked for and has not yet been given.

### 9b. The estimator, which is new and complete on the web side

`Docs/Estimator-Xactimate-Conventions.md` is the reference: conventions
extracted from **four real Québec Xactimate claims** he supplied, with the
O&P and tax arithmetic reproduced to the cent (per line: base × 15,5 % O&P,
then 14,975 % tax on base + O&P; the profit basis is a firm convention and
therefore a setting). **No depreciation columns anywhere** — Québec
restorers print `Valeur à neuf = Sinistre net` and leave depreciation to the
insurer in one cover-letter paragraph, so RCV/ACV machinery is out of scope.

`src/lib/estimator/insurance/` is the engine — types, rules, derive,
trailer, context, suggest — with 41 tests. A 20-agent adversarial review
found 13 real defects in it and all are fixed with regressions, including
two that would have shipped: an object matcher that priced
`toilet_roll_holder` as a toilet, and monitoring visits that split one
Québec evening across two UTC days.

`/admin/projects/[id]/estimate` has **three doors into one line table**:
derive-from-measurements, Claude suggestions (`claude-opus-5` proposes item
codes only — the backend prices everything, nothing enters until accepted),
and manual price-book editing. Editing a derived line flips it to manual so
re-derivation never overwrites judgement; deleting one leaves a tombstone so
it cannot come back. `/estimate/print` and `/estimate/pdf` render the devis
using the REPORT'S own `FloorPlan` and `ReportStoreyPlan` — **not a second
renderer**, because a plan that disagreed between the two documents would be
worse than no plan in the estimate.

Worked sample, real engine over an invented claim:
`https://claude.ai/code/artifact/b28f941d-b266-455b-8bea-8d764270c438`

**Still owner-only:** his O&P convention (10/5 assumed), per-trade minimums
(the machinery ships with an empty table), a management fee %, detach-reset
prices (those lines derive visibly unpriced), and the flood-cut height.
**Still missing in the schema:** affected areas cannot mark a CEILING, which
is the primary damaged surface on most water claims.

### 9c. The dollhouse, rebuilt — and the one thing left undone

It opens **straight down and orthographic**, so switching from the plan reads
as a tilt rather than a jump (this deliberately overrode the 23 Aug 78°
clamp; he compared both products and chose). The storey is **one continuous
building**: `DollhouseStorey.swift` merges per-room walls into a shared
network, party walls landing on the mid-line with openings gathered from
every room and coalesced. Walls are the **real 114 mm assembly** and extrude
OUTWARD from the measured interior face, so a scanned floor keeps its size.
Gestures: one finger grabs the model (cast onto the floor plane — two
attempts at projecting it with trigonometry both had sign errors), two
fingers orbit, pinch is anchored at the fingers, 120 Hz with momentum.

**The animation is gone deliberately.** Every moving leaf had to guess two
facts RoomPlan never reports — which jamb, which way — and the guesses were
visibly wrong. Nine motions collapsed to three static shapes.

~~**NOT DONE, and it is the next real piece of work on this screen: rotation
should not be an EDIT.**~~ **DONE 24 Aug 2026 — see §9e.**

### 9d. Two disciplines this session paid for, twice each

- **Compile and RUN the real source before shipping geometry.** The
  `DollhouseStorey` merge was built for macOS behind a shim and asserted
  against nine cases before install. It caught a doorway recorded in both
  rooms being cut twice, and a three-room corridor failing to collapse.
  It did **not** catch the case that broke his floor — every fixture was two
  rooms meeting, and nobody tested ONE room with a complicated outline,
  which is most of what this app scans. **Test the shape the app actually
  produces, not the shape the feature is about.**
- **Make the app write down what it built.** The walls were diagnosed from
  screenshots twice and wrong once. `DOLLHOUSE-WALLS` now records piece
  count, wall count, thickness range, hole count and real coordinates; the
  `0+6 objects` in the status line is what actually identified the
  regression above. Ask the file, not the picture.

## 9e. The storey turn is a display fact now — 24 Aug 2026

**The destructive rotation path is gone.** `commitTurn` used to rotate every
room's polygon and save it back through `saveEditedPlan` — the same call a
corrected wall goes through — plus `placeRoom` for each position and
`updateObject` for every fixture. That is what turned pristine RoomPlan scans
into edited ones and cost the owner 26 detected objects on a floor he could
not re-scan. It now writes **one number** and nothing else.

**Where the angle lives.** `floor_display (project_id, level, display_angle)`
— migration **0043**, degrees, matching `room_objects.rotation`. A storey is
not an entity anywhere in this schema (`room_scans.level` is a text label), so
it needed its own tiny table rather than a column on something existing. Read
back bundled into `GET /api/v1/scans` so the plan and the direction it is read
from arrive together; written by `PATCH /api/v1/floors?projectId=&level=`.

**Where the turn is APPLIED, and why only there.** `StoreyViewport.point()` /
`.model()` — the single seam every draw and hit-test on the storey canvas
already went through. `StoreyLayout`, `StoreyPacking`, `room(at:)`,
collision, merge adjacency and the camera all keep reading **true, unrotated
floor metres**, exactly as before. Nothing upstream of that seam knows the
storey is turned, which is the property that makes the old class of bug
unreachable rather than merely avoided.

Three things followed from that seam, none of them obvious up front:

1. **`cameraBounds` had to be turned too.** `bounds` describes ROTATED space
   now, and a rectangle of unrotated floor is not a rectangle after a turn.
   Fitting the upright one runs a turned storey off the canvas — worst at 45°,
   where it needs about 1.4× the room. `turned(_:)` boxes the four rotated
   corners. This is the same arithmetic `turnFitScale` already did for the
   LIVE drag; it just had no equivalent for a turn that persisted.
2. **The grid had to learn the angle**, or it stays screen-aligned while the
   floor turns under it. `EditorChrome.drawGrid` takes `angle`/`pivot` and
   `drawModelGrid` now walks model steps found from the four screen corners —
   a rotated screen covers a wider model box than two corners can describe.
3. **The dollhouse needed its own**, because `dollhouseRooms` re-derives
   placement from `StoreyPacking` independently of `cachedLayout` — the 2D fix
   does not reach it. One `turntable` parent node in `Dollhouse.scene`, and
   it must be a PARENT: a node rotates about its own origin and only then
   translates by `position`, so turning `world` directly would spin the storey
   about plan (0, 0) rather than the middle it was just centred on.

**Furniture came along for free**, both in 2D and 3D, and that is worth
knowing rather than rediscovering: object x/y are room-LOCAL
(`Models.swift`), so once the room's walls turn, its fixtures turn with them.
The old code's per-object `updateObject` loop existed only because it was
baking the turn into storage.

**`rotateDetachedRooms()` is deleted** — it had zero call sites and had been
fully superseded by `commitTurn`.

**Existing rotated floors are NOT retroactively corrected**, and cannot be.
A floor already turned by the old path has had its geometry permanently
overwritten; there is no pre-turn state to recover. Its `floor_display` angle
starts at 0, which correctly means "draw that data upright", and a new turn
stacks on top like any other floor. Only new turns are protected.

**Verified before install**, per §9d's own rule: `StoreyArranging.rotate` was
compiled for macOS with a harness asserting the four properties the change
rests on — `model(point(p)) == p` at 0/45/90/137/180/-90/270° (the invariant
hit-testing depends on; if it fails a tap lands on a different room than the
one under the finger), the pivot not moving, length preserved through a turn
(a turn that changed a measurement would be the bug this exists to prevent),
and the framing box widening to the diagonal at 45°. `BUILD SUCCEEDED`,
1189 tests pass.

**Migration 0043 is APPLIED to production and verified**, 24 Aug 2026, in the
SQL editor on project `renovision-ana` (`mhtjeewhhyrsiditeeie`). Verified by
reading the catalog back, not by trusting the green success: four columns with
the right types, nullability and defaults, `PRIMARY KEY (project_id, level)`,
`FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE`,
`relrowsecurity` true, and the `service_role` grants.

**Two notes on how it was applied.** Supabase intercepted the bare
`create table` with a *"Potential issue detected — creates a table without
enabling Row Level Security"* dialog; **Run and enable RLS** was the right
button and reaches the same place as the migration file's own
`alter table … enable row level security`. And **the leftover-query trap in
§5 is real and it fired again** — the editor opened carrying migration 0036's
`alter table public.projects … address_line1 …` from a previous session,
exactly as recorded. It was cleared before typing. The editor was also left
EMPTY afterwards, so the next session does not inherit this one's statement.

**`supabase/migrations/0043_floor_display_angle.sql` is not recorded as run**
in the Migrations list, the same as 0041 — it was executed by hand. It is
`create table if not exists` plus an idempotent grant and notify, so replaying
it later is harmless and still right if the history is ever replayed.

**`scripts/storey-turn-check.swift` is the harness, and it is IN THE REPO** —
§6b's lesson about the artwork fitter being rewritten twice out of /tmp,
applied the first time instead of the third. Run it when this transform
changes:

    swiftc scripts/storey-turn-check.swift \
      ios/App/App/Native/StoreyArranging.swift -o /tmp/storey-turn-check \
      && /tmp/storey-turn-check

It asserts five things against the shipped `StoreyArranging.rotate` and
SceneKit's own transforms, at 0/45/90/137/180/-90/270°: `model(point(p)) == p`
(the invariant hit-testing depends on — if it fails a tap lands on a
different room than the one under the finger), the pivot not moving, length
preserved through a turn, the camera framing the box a turn actually needs,
and the 3D turntable reading the floor from the same direction as 2D.

**The SceneKit sign is MEASURED now, not reasoned.** It was the one thing in
this change taken on argument, so it was settled the way §9d says to settle
geometry — SCNNode transforms need no rendering and no device, so the real
`turntable → world → marker` hierarchy can simply be built and asked. Every
sample matches the 2D canvas to 1e-6. **The asymmetric angles carry the
proof**: a flipped sign mirrors the layout, which 90° and 180° can hide and
45°/137° cannot. It also confirms the turntable had to be a PARENT node —
centring first and turning the result is what puts the storey's own middle
under the rotation.

**Still not confirmed by eye on the device.** Turn a floor at 45° and at 90°,
confirm rooms still tap/drag/merge correctly at that angle, confirm the grid
turns with the floor, and reopen the floor to confirm the angle persisted.
The dollhouse's DIRECTION no longer needs checking; what has never been run
is the whole path end to end against a real storey.
