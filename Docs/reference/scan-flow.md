# magicplan's scan flow, screen by screen

Sent by the owner 20 Aug 2026 as the reference for ORD-45 items 3, 4 and 6.
**Recorded as it arrives. Nothing built from it yet** — his instruction was
to wait until the whole set is in.

## 1 — "For best results…", the screen after tapping Scan

A dark scrim over the live camera. Back chevron top-left in a light rounded
square. Title, then five tips, each with a thin line icon:

- **Turn on the lights in your room (min. 50 lux).**
- **Stop scan after every room, and stay on the same floor.**
- **Close all the doors to create an enclosed shape.**
- **Use "Manual AR Scan" if you have an open concept floor plan.**
- **Avoid scanning more than 2000 sq ft in a single session.**

Bottom centre: the word **Begin**, and under it a **big red record button** —
a filled red circle inside a white ring. Not a "Start" button. A RECORD
button.

**And it means it.** The owner: *"it is basically video recording
everything so you can save it on your device to review it after."*

Two things follow from that, neither of which we do:

1. **Coaching before the walk, not warnings during it.** Every one of those
   five tips is a scan that would otherwise come out wrong — bad light, two
   floors in one session, an open door leaving the outline unclosed, too big
   a session. We currently say nothing before a scan and one thing during it
   (the open-outline warning). Their advice is free and lands before the
   mistake.
2. **The session is recorded to video.** Which makes the scan reviewable
   after the fact — what the room looked like, on the day, without relying on
   anyone having taken the right photo. For a claim that is evidence.
   Related: S7 / ORD-29, video and 360.

Ours by comparison: tapping Scan goes straight to the RoomPlan capture view.
No coaching, no recording.

## 2 — "Select Room Type", after the walk

A sheet over the still-live camera. Title `Select Room Type`, then a
two-segment control: **Residential | Commercial**.

**We have no Commercial tab at all**, and the owner's note is that this
particular job WAS one: *"check the categories. We don't have this. We don't
have office, private office, but this job actually was office."* The room in
the reference report he sent is typed `Private Office`.

### Residential (as far as the screen shows)

Kitchen · Dining Room · Living Room · Hall · Bedroom · Primary Bedroom ·
Children Bedroom · Bathroom · Half Bathroom · Closet · Study · Music Room ·
Balcony · Garage · Hallway · Laundry Room · …

### Commercial (as far as the screen shows)

Private Office · Shared Office · Open Space · Meeting Room · Conference Room ·
Reception · Kitchenette · Cafeteria · Hall · Closet · Balcony · Garage ·
Hallway · Lounge · Waiting Room · Workshop · …

Both lists run past the fold; these are the entries actually visible.

### What this changes

`ORD-22` already called for the Residential/Commercial split and said to take
the SPLIT but not their list, on the argument that theirs is an office
fit-out vocabulary while a flooded commercial building needs mechanical room,
electrical room, server room, warehouse bay, loading dock.

That argument still holds for what to ADD — but it was also being used to
delay, and this job proves the cost: he scanned an office and had nowhere to
say so. The right reading now is that their list is the floor, not the
ceiling: ship it, then add the ones a restoration job needs on top.

Note also **where** this sits: the type is asked AFTER the walk, over the
live camera, not before. Ours asks in the review sheet, which is the same
moment.

## Still to come

The screenshots for ORD-45 items 3, 4 and 6 — what a detected door, window
and object actually LOOK like on their overlay while scanning.

## 3 — Mid-scan, with a door and a shelving unit detected

The screenshot that settles items 3, 4 and 6 — and it settles them by
showing that **most of it is not theirs.**

What is on screen:

- **Everything detected is WHITE**, translucent, and genuinely three
  dimensional — the doorway is a white plane filling the opening, the wall on
  the right is a white wash over the brick, and the shelving unit at the
  bottom is a **white wireframe box with the stock inside it drawn as small
  white blocks.** It is in perspective. It sits ON the objects and stays
  there while the camera moves.
- **A white rounded card at the right edge**, holding a **door glyph** and a
  **‹ chevron**. That is the type control: it names what is being looked at
  and opens to change it. It is NOT a badge stuck on the object.
- A grey **`2D`** pill under it — switch to the plan view mid-scan.
- A dark plate at the bottom: **"Scanning… / Stop after every room"**.
- A **red square** in a white ring — stop, because this is a recording — and
  beside it a **white circle in a white ring**: a camera shutter. Photographs
  can be taken DURING the scan.

### The thing to understand before writing any code

**That white massing is Apple's, not magicplan's.** `RoomCaptureView` draws
exactly this by default: translucent white geometry for walls, doors,
windows and objects, in the AR scene, tracked properly because it lives in
the world rather than being projected onto the glass each frame.

Which means all three complaints have the same root:

| His words | Cause |
|---|---|
| *"I want it to be a white silhouette, and it needs to have a shape and the design of a door"* | We draw our own flat blue quads OVER Apple's white massing. |
| *"when I'm turning the camera they are not really sticking… not smooth"* | Ours is a screen-space projection recomputed on RoomPlan's geometry callback — throttled to 0.15s, and only when the GEOMETRY changes, while the camera moves every frame. Apple's is in the scene and cannot drift. |
| *"all this like orange ugly design"* | Same overlay: our badges and their amber "uncertain" state. |

**We were building a worse copy of something already on screen.** The answer
is to stop drawing silhouettes and badges, let RoomCaptureView's own massing
be the silhouette, and add the one thing they add that Apple does not: the
card at the edge naming the detection, with a way to change it.

That also removes the projection code, the 60fps clock problem, and the
hit-testing — none of which need to exist.

### What we still owe, from this screen

1. The **type card** at the right edge: glyph, chevron, tap to change.
2. The **shutter** — a photo taken during the scan, filed to the room.
3. The **`2D` toggle** — the plan view while still walking. We have a
   mini-map; theirs is a full switch.
4. The **coaching plate**: "Scanning… Stop after every room".
5. **Stop is a red square**, because the session is a recording.

## 4 — Stopping a room

Camera still live, pointed at the floor. A dark rounded card in the middle
holding the room just walked, drawn as a **green filled outline** with a
**green pose wedge** at the corner showing where the operator is standing.

Under it: **"Scan another room"**. Under that: the **red record button**
again. Top-left: **Done**.

So stopping does not end the visit — it ends a ROOM. You see what you just
caught, and the same red button starts the next one. `Done` is the way out.

Ours shows a mini-map DURING the walk and nothing after it; this is the
reverse, and it is the moment the reference chooses to give feedback: after
the room, when you can still walk back.

## 5 — "Configure Floor Plan", after Done

A sheet. `X` top-left.

```
Include Objects
  ☑ Plumbing Fixtures   Like Bathtub, Sink, Toilet, etc.
  ☑ Appliances          Like Oven, Dishwasher, etc.
  ☑ Furniture           Like Sofa, Bed, Table, Chair, etc.

  Remember my choices                                    [on]

Session Replay
  Save Video recording                                   [off]
  When enabled, a video of each room's scan will be saved and attached
  to the corresponding room. If disabled, the recordings will be
  discarded after the scan.

              [ Generate Floor Plan ]
```

**Two things settled here.**

**This is how they avoid the clutter.** Objects are filtered by FAMILY at
generate time — three checkboxes, remembered between scans. Not a question
mark per detection. A restoration operator who never wants furniture turns
Furniture off once and never sees it again.

**And the video is opt-in, off by default, attached PER ROOM.** The whole
session is recorded regardless — that is why the button is red — but it is
discarded unless this is on. So the recording is a scanning aid first and
evidence second, and the storage cost is a deliberate choice rather than a
surprise.

## 6 — The finished plan

`Ground Floor`, then the room: **Private Office · 26.63 m²**.

Walls solid black and thick. Doors cut in with a real swing arc. Grid of pale
blue `+` crosshairs, which is what we already draw.

**The objects are line drawings, in plan, at true size and position** — five
chairs along a table, a desk run, an armchair at an angle, a mat by the door.
Simple white fills with a thin black outline. Nothing shaded, nothing
coloured, no badges, no labels on them at all.

That is the answer to *"the design is very ugly"*: theirs are quiet outline
figures that read as furniture at a glance and disappear into the drawing.

Bottom bar is a single **Insert**, plus `Swipe up ↑ for Ground Floor info`.
Top bar: back chevron, `Ground Floor`, `?`, share. Undo/redo top-left of the
canvas, layers and `2D` top-right — all of which we already have.

## 7 — Stopping: "Review Scan"

The red square opens a sheet, and it is better than ours in one specific way.

```
        (green tick with a warning badge)
        Room scan complete, but…
  "Kitchen" had an opening. To prevent data loss,
  we tried to close the room shape as shown below.

        [ the room, green, on a dark card ]
        · solid green edge  = walls it actually walked
        · DASHED green edge = the stretch it guessed
        · ORANGE segment    = the opening it closed across
        · green wedge       = where the operator stood

             [ Confirm Scan ]   (blue, primary)
             Discard & Rescan   (red text)
```

**We already draw the dashed guessed edge** — that decision was made and is
right. What theirs does better is everything around it:

- It **names the room** and says what went wrong: *had an opening*.
- It says **what the app did about it**: *we tried to close the room shape*.
- It marks **where** in a colour of its own, so the guess has a location
  rather than being a dash somewhere on the loop.
- `Discard & Rescan` says what happens next; our `Discard` does not.

## 8 — Video: the toggle, and the consent behind it

`Save Video recording` on the Configure sheet is **off by default**. Turning
it on raises:

```
        Save videos of your scan?
  magicplan can save videos of your room scans to help with
  documentation and dispute resolution. Videos may include
  surroundings, so ensure permission before recording.

        [ Continue without videos ]   (BLUE, primary)
        [ Save videos ]               (secondary)
```

**Read the button order.** The primary, highlighted, easy button is the one
that does NOT record. Recording someone's home is the sensitive act, so the
safe choice is the one under the thumb — and the copy tells the operator to
get permission from whoever lives there. That is a deliberate piece of
design and worth copying exactly.

### Where ours differs, on the owner's instruction

He was explicit, 20 Aug: *"this video shouldn't go to our server because
it's heavy… when the scan is done, we have to prompt a user to save it on
their phone… when they click to not save, it's gonna prompt them like, okay,
if you don't wanna save, you're gonna lose the video."*

So theirs attaches the video to the room (their storage); **ours saves to the
phone's own Photos library and never uploads**. That is the cheaper and, for
a one-operator business, the more useful arrangement — a few hundred MB per
room would dominate everything else the storage bill has in it.

Two consequences that follow and are not optional:

1. **Add-only Photos permission**, not full access. The app never reads his
   library; it only puts something in it, and iOS has a narrower permission
   for exactly that. Asking for more than is needed is how an app gets
   refused the thing it does need.
2. **The prompt is the last moment the video exists.** Once the capture
   session ends the frames are gone, so "save it later" is not offered
   because it cannot be honoured. That is what makes his second prompt —
   *you will lose it* — a true statement rather than a scare.
