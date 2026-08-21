# The camera, and the photo well

Two screenshots, 20 Aug 2026, from his own phone.

## 1. Their camera

Full screen, black, portrait.

```
Cancel                    Photo
┌──────────────────────────────────┐
│  live preview, rule-of-thirds    │
│                          ┌────┐  │
│                          │ .5 │  │
│                          │ 1x │  ← yellow when selected
│                          │  2 │  │
│                          │  3 │  │
│                          └────┘  │
│           Aug 20, 2026 • 10:53 PM│  ← burned in, bottom RIGHT
└──────────────────────────────────┘
   ⟲        ▣        ⚡̸        ⚙
        VIDEO   PHOTO   360
   ▢            ◯
 (last shot) (shutter)
```

Four things a `UIImagePickerController` cannot do, which is why ours is now
its own `AVCaptureSession` — `ios/App/App/Native/SiteCamera.swift`:

1. **The stamp is on the preview**, not only on the file. The operator sees
   the date before pressing the shutter. Format, to the letter:
   `MMM d, yyyy • h:mm a`, bottom right, white with a shadow — no plate.
   Ours printed `2026-08-20 22:53` bottom LEFT behind a black plate; both
   changed to theirs.
2. **VIDEO and PHOTO in one place.**
3. **Lens buttons.** `.5 1x 2 3`, only the ones the handset has. Note that
   `videoZoomFactor == 1` is the ULTRA-WIDE on a phone that has one, so the
   number a person calls `1x` is the first virtual-device switch-over —
   getting this backwards puts every photograph one lens too wide.
4. **A grid.**

**360 is not built.** Their third mode stitches an equirectangular panorama.
A tab that opens something else would be worse than no tab.

**Video goes to the phone's own Photos, never to us** — his instruction,
20 Aug: *"this video shouldn't go to our server because it's heavy."*
Needs `NSPhotoLibraryAddUsageDescription`, added.

Their fourth bottom control is a settings gear opening magicplan's own
preferences. Ours has three; a gear that opens nothing is worse than no gear.

## 2. The photo well, and the `+` menu

From the affected-area sheet, `Photos & Notes` tab:

```
Photos
┌────────────────────────────────┐
│  +   ▩   ⌐ ¬   ⌐ ¬             │   4 across, dashed empty slots
│  ⌐ ¬  ⌐ ¬  ⌐ ¬  ⌐ ¬            │
└────────────────────────────────┘
Notes
┌────────────────────────────────┐
│ Add note…                      │
└────────────────────────────────┘
```

Tapping `+` raises a two-row menu, NOT a camera:

```
Camera            Take Photo, 360 or Video   📷
Photo Library     Choose Photo or Video      🖼
```

That matters on site: half the useful photographs were taken an hour before
the app was open, and a `+` that always opens a viewfinder makes those
unreachable.

**The dashed slots are the point of the design.** They say how many
photographs the thing is expecting. Ours was a horizontal strip that showed
nothing at all until the first photo existed, so nothing on screen ever
asked for one.

## What this turned up

`Photos & Notes` **had no notes in it.** `PATCH /api/v1/scans/{id}` has
always accepted a `notes` field and `ReportDocument` has always printed it
under the room — the only thing missing was a box on the phone standing in
the room. Added, with `Tidy up` beside it, the same AI polish the affected
area's notes already have.

**And a bug the simulator found that reasoning did not.** The note first
saved on losing focus. In testing the keyboard went away, the text stayed on
screen, and nothing was written — a tap that dismisses a keyboard does not
always travel back through `@FocusState`. A note that looks saved and is not
is the worst failure this box can have, so the trigger is the text itself:
900ms of quiet, then a PATCH, plus one more on the way out.

`RoomNoteDrafts` holds what this phone has written since launch. The
inspector is rebuilt from a room list fetched when the storey opened, so the
moment a note is saved that list is stale — without the draft the operator
writes a sentence, reopens the panel and sees an empty box.
