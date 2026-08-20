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
