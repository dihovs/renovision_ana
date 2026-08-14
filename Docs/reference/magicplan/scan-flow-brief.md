# Scan flow — implementation brief

Everything observed in a 2:50 on-device screen recording of a real magicplan **Auto-Scan**
(workshop/garage, 14 Aug 2026), written as build instructions.

> **Superseded in part.** This brief was written from low-fidelity mirrored playback. The
> source video has since been transferred and frames extracted at native resolution
> (1320x2868). **`interactions-scan.md` is now the authoritative record** — it is complete,
> frame-cited, and corrects two errors here. This document is kept for its state machine and
> HUD breakdown.
>
> Missed in this draft, documented in `interactions-scan.md`:
> the "For best results…" tips gate (INT-S01), the in-capture incompleteness warning
> (INT-S07), `Discard & Rescan` (INT-S11), the Configure Floor Plan object filter (INT-S15),
> and the video-consent modal (INT-S16).

**Provenance.** Layout, copy and state transitions are directly observed unless marked
*[inferred]* or *[uncertain]*. No pixel measurements or colour values.

---

## 1. State machine

```
methodChooser
   └─(Auto-Scan)→ calibrating ──→ scanning ⇄ roomComplete
                                       │           │
                                       │           ├─(Scan another room)→ scanning
                                       │           └─(Done)→ roomTypePrompt
                                       │
                                  roomTypePrompt → reviewScan → planEditor
```

Two things worth noting because they are the opposite of the manual paths:

- **Room type is asked *after* the scan**, not before. Manual methods (Draw Room, Add Square
  Room) ask first. Auto-Scan captures geometry, then classifies.
- **Multi-room is a loop inside one session.** You do not return to the method chooser between
  rooms. Stop → footprint freezes → "Scan another room" → keep going. `Done` exits the loop.

---

## 2. Method chooser

Sheet, header `Add Room` / subtitle `Choose a method`, `✕` top-right.

Row 1 — two large cards side by side, each with an isometric illustration and a `LiDAR` badge
top-right:

| Card | Subtitle |
|---|---|
| **Auto-Scan** | "Scan multiple rooms. Auto object detection." |
| **Manual-Scan** | "Scan one room. Manual object detection." |

Below — list rows with icon, title, subtitle, chevron:

| Row | Subtitle |
|---|---|
| Add Square Room | "Start with a template. Then tweak the shape." |
| Draw Room | "Add corner points to build the room shape." |
| **Import & Draw** | "Trace over an image of an existing plan." |

**The fifth row is contextual.** On an empty floor it is *Import & Draw*. Once rooms exist it
becomes *Add Filler…* ("Automatically fill the space between rooms"). Both were observed, on
different floors.

---

## 3. Calibrating

Camera live, background dimmed. Centred: a white wall-shaped outline (trapezoid in
perspective) with a small phone-position indicator beside it. Caption below in white:

> **"Point camera at top edge of wall"**

Red stop button already present at the bottom. No other chrome.

Purpose is to establish the wall plane and height before tracking begins. *[inferred]*

---

## 4. Scanning HUD

The core state. Layered over the live camera feed:

| Element | Position | Behaviour |
|---|---|---|
| **Edge tracing** | in-world | Glowing white lines snap along wall/ceiling/floor junctions and vertical corners as they resolve. They appear progressively, not all at once. |
| **Surface planes** | in-world | Detected wall areas fill with translucent white quads. |
| **Opening markers** | in-world | Doors and windows get their own white rectangle **plus a small white diamond at the centre**. A separate grey rectangle appeared at one door's base *[uncertain — possibly a threshold or a partially-resolved plane]*. |
| **Object rail** | right edge, vertically centred | A small floating card with an icon and a `<` chevron — a collapsed stack of detected items. Never expanded on camera; contents unknown. |
| **`2D` / `3D` pill** | right edge, below the rail | Small rounded pill. Label flips between `2D` and `3D`; toggles the inset preview's mode. |
| **Status chip** | centred, above the controls | Dark rounded rect, two lines: **"Scanning…"** / **"Stop after every room"**. Persistent throughout. |
| **Inset mini-map** | lower third, centred | Dark rounded card. Live 2D build-up: green polyline wall traces, orange segments (*[inferred]* — most likely the current/unresolved wall), and a **green cone cursor** showing camera position and heading. |
| **Stop** | bottom centre | Large red rounded square. |
| **Capture** | bottom right | White circle — photo capture during scan. *[inferred]* |

### The mini-map is the thing to copy

It is the single best idea in this flow. The operator gets continuous feedback on whether the
polygon is closing without ever leaving the camera view. That is what makes their "stop after
every room" discipline workable in practice — you can see the shape failing while you still
have a chance to fix it.

Build this early. It is cheap (you already have the geometry) and it converts scanning from a
blind activity into a steerable one.

---

## 5. Room complete

Reached by pressing Stop.

- `Done` button appears **top-left** (white pill)
- Inset mini-map now shows the **completed footprint as a filled green polygon**, with the
  cone cursor still live
- Status chip changes to **"Scan another room"**
- Red stop button remains — pressing it starts the next room

---

## 6. Room type prompt

Standard sheet: title `Select Room Type`, segmented control `Residential | Commercial`,
then a list truncated to six common types (Kitchen, Dining Room, Living Room, Bedroom,
Bathroom, Balcony) with a blue `See more`.

Identical component to the manual paths — see spec §4.6.

---

## 7. Review Scan — the important one

Modal sheet. Top to bottom:

1. Title: **`Review Scan`**
2. A green circle-check icon with a **warning badge** overlapping its lower-right
3. Bold heading: **"Room scan complete, but…"**
4. Grey centred body, naming the room and stating what was done:

   > *"'Kitchen' had an opening. To prevent data loss, we tried to close the room shape as shown below."*

5. Dark rounded preview card: the resulting polygon filled green, with the **auto-inferred
   edge drawn as a dashed/hatched line** so the user can see exactly which wall was guessed
6. Full-width blue primary button: **`Confirm Scan`**

### CORRECTED — the reject path exists

An earlier draft of this section claimed Review Scan had **no reject affordance**. That was
wrong, and the error came from reading low-fidelity mirrored playback that cut off below the
primary button. The native-resolution frame is unambiguous:

- Blue filled primary: **`Confirm Scan`**
- Red text secondary directly beneath: **`Discard & Rescan`**

See `screens/scan-09-review-scan.jpg` and `interactions-scan.md` INT-S11.

There is also an **earlier** safety net, missed entirely in the first pass: while still scanning,
a popover appears above the stop control reading **"Your room might be incomplete…"** with a
**`Finish Anyway`** button (`screens/scan-08-incomplete-finish-anyway.jpg`, INT-S07). So the
real design is two-stage — warn while the user is still standing in the room and can fix it,
then explain and offer a rescan after.

That is better than what this document originally recommended building. Copy it:

1. **Warn during capture**, not only after. Catching an open polygon while the operator is
   still in the room is worth far more than catching it once they have left.
2. **Auto-close, but show the inferred edge dashed** so the user knows exactly which wall to
   distrust.
3. **Keep the reject path visually subordinate** — filled primary, text-only destructive
   secondary.
4. Still worth adding on our side: a numeric sanity check (area floor, aspect-ratio ceiling)
   so a degenerate sliver leads with the problem rather than a green tick. The green check
   with a warning badge is a mixed signal.

## 8. Result

Scan output lands in the 2D editor as a normal room:

- Thick black wall bands, light grey fill
- Centred label: room name over area
- Door rendered with a **quarter-circle swing arc**
- Windows rendered as breaks in the wall line
- Standard editor chrome: `< 2D` back, floor title, undo/redo, `+ Insert`

So: no separate "scanned room" type. It becomes an ordinary editable room immediately, which
is the correct architecture — one geometry model, many ways to populate it.

---

## 9. Wall / Elevation view

Observed post-scan. Title `Wall`, subtitle = floor name, `< 2D` back, `?` and share icons.
Undo/redo row, two stepper controls top-right. Canvas is mostly empty grey with a horizontal
line near the top representing the wall's top edge.

**New detail:** circular **←** and **→** buttons at mid-left and mid-right, stepping through
the walls in sequence. That turns wall-by-wall inspection into a linear task instead of a
hunt-and-tap. Worth copying. Bottom bar is `+ Insert`.

---

## 10. Guidance copy seen elsewhere in the app

From an in-app tips screen *[seen as a Photos thumbnail, not in the video — treat as
approximate]*:

- "Stop scan after every room, and stay on the same floor"
- "Close all the doors to create an enclosed shape"
- "Use 'Manual AR Scan' if you have an open concept floor plan"
- "Avoid scanning more than 2000 sq ft in a single session"

These are real operational constraints of LiDAR room capture, not arbitrary advice. Expect to
surface equivalents. The 2000 sq ft ceiling in particular suggests drift/memory limits worth
testing for early.

**RESOLVED — not magicplan.** The "NAME THIS ROOM" screen with room-type chips and
`Save room` / `Scan again`, flagged here as possibly an older magicplan build, is
**RenoVision's own "Room measured" screen**. See `../phone-build-screens/rv-11-room-measured.jpg`
and `../PHONE-BUILD-AUDIT.md` §6.

---

## 11. Mapping to RoomPlan

Most of the above is achievable with Apple's framework rather than from scratch:

| Observed | RoomPlan equivalent |
|---|---|
| Edge tracing, surface planes, coaching | `RoomCaptureView`'s built-in coaching overlay |
| Door/window rectangles | `CapturedRoom.doors`, `.windows`, `.openings` |
| Object detection | `CapturedRoom.objects` (bed, sofa, table, storage, toilet, bathtub, sink, appliances, stairs…) |
| Multi-room chain | `RoomBuilder` / `CapturedStructure`, iOS 17+ |
| Calibration prompt | RoomPlan's own instructions |
| **Inset mini-map** | **not provided — build it** |
| **Review Scan** | **not provided — build it, with the reject path** |
| **Room type prompt** | **not provided — yours** |

Verify against current Apple docs before relying on any of this; it is from knowledge, not a
document just read.

Do not persist `CapturedRoom` as your schema — map it into the model in `MVP.md` §2 at import.
Manual edits and dimension locks have no representation in Apple's type.
