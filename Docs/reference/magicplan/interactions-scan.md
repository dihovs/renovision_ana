# Scan flow — interaction log

Source: `scans/autoscan-2026-08-14.mp4` — 1320×2868, 120 fps, 169.7 s, on-device screen
recording of a real magicplan Auto-Scan (workshop/garage, 14 Aug 2026). Frames extracted at
native resolution; timestamps cited are from that file.

Everything below is directly observed unless marked *[inferred]*.

> **Correction to an earlier claim.** An earlier draft of `scan-flow-brief.md` stated that
> Review Scan had no reject path. **That was wrong.** `Discard & Rescan` sits directly under
> `Confirm Scan` (INT-S11). The earlier reading came from low-fidelity mirrored playback that
> cut off below the primary button. The brief has been corrected.

---

## Timeline

| Time | State |
|---|---|
| 0–8 s | Launch via Spotlight, projects list |
| 8–14 s | Floor editor, `Insert` → `Room` → `Auto-Scan` |
| 14–19 s | "For best results…" tips gate |
| 19–24 s | Calibration |
| 24–89 s | Room 1 scanning |
| 89–93 s | Incompleteness warning |
| 93–99 s | Review Scan |
| 99–104 s | "Scan another room" |
| 104–118 s | Select Room Type |
| 118–137 s | Room 2: calibration + scanning |
| 137–149 s | Configure Floor Plan + video-consent modal |
| 149–169 s | Result: 2D → 3D → wall elevation |

---

### INT-S01 — Enter the scan gate

| | |
|---|---|
| **Before** | `screens/27-insert-menu.jpg` — floor editor, `Insert` popover open: Room / Object / Note / Photo / Form |
| **Action** | Tap `Room`, then `Auto-Scan` on the method chooser (`screens/28-add-room-method-chooser.jpg`) |
| **After** | `screens/scan-01-best-results-tips.jpg` — full-screen dark gate, heading **"For best results…"** |
| **Mechanism** | An interstitial before the AR session, not a settings screen. Five icon+text rows, a small `Begin` button, and the red record control already visible beneath it — the capture UI is mounted behind the gate. |
| **Build note** | Worth copying. The five constraints are real physics, not marketing, and a user who ignores them produces bad geometry you cannot repair later. |

The five rules, verbatim:

- Turn on the lights in your room (min. 50 lux).
- Stop scan after every room, and stay on the same floor.
- Close all the doors to create an enclosed shape.
- Use "Manual AR Scan" if you have an open concept floor plan.
- Avoid scanning more than 2000 sq ft in a single session.

The 2000 sq ft ceiling implies a drift or memory limit. Test for ours early.

---

### INT-S02 — Begin → calibration

| | |
|---|---|
| **Before** | `screens/scan-01-best-results-tips.jpg` |
| **Action** | Tap `Begin` |
| **After** | `screens/scan-02-calibrate-point-at-wall.jpg` — live camera, dimmed; a white wall-shaped outline in perspective with a small phone-position glyph beside it; caption **"Point camera at top edge of wall"**; red stop button already active |
| **Mechanism** | Establishes the wall plane and ceiling height before tracking starts. *[inferred]* The scan is already recording — stop is live during calibration. |
| **Build note** | RoomPlan's own coaching handles this. Don't rebuild it; do keep an equivalent copy line. |

---

### INT-S03 — Scanning: in-world 3D preview

| | |
|---|---|
| **Before** | `screens/scan-02-calibrate-point-at-wall.jpg` |
| **Action** | Move the phone; sweep walls |
| **After** | `screens/scan-03-scanning-planes.jpg` — glowing white lines snap along wall/ceiling/floor junctions; a **white massing model of the room so far floats anchored in world space**; status chip **"Scanning… / Stop after every room"**; pill labelled `2D` at right; red stop centre, white circle right |
| **Mechanism** | The floating white shape is a live 3D preview of captured geometry, pinned in the room rather than to the screen. The pill shows the mode you would *switch to* — so `2D` visible means you are currently in 3D preview. |
| **Build note** | The in-world anchoring is what makes it legible — it sits where the room is, so you read it without re-orienting. |

---

### INT-S04 — Toggle to the 2D mini-map

| | |
|---|---|
| **Before** | `screens/scan-03-scanning-planes.jpg` — pill reads `2D` |
| **Action** | Tap the pill |
| **After** | `screens/scan-04-scanning-minimap.jpg` — the white massing is replaced by a **dark rounded card** showing the plan in 2D: green polyline wall traces, an orange segment, and a **green cone cursor** for camera position and heading. Pill now reads `3D` |
| **Mechanism** | Two preview modes over one geometry model. Green = resolved walls; orange = the wall currently being captured *[inferred]*; the cone is live pose. |
| **Build note** | **Build this.** RoomPlan gives you nothing like it, and it is the single best idea in their scan. It converts scanning from blind sweeping into a steerable task — you can watch the polygon fail to close while you still have time to walk back. |

---

### INT-S05 — Opening detection

| | |
|---|---|
| **Before** | `screens/scan-05-scanning-minimap-2d.jpg` |
| **Action** | Point at a wall containing a door or window |
| **After** | `screens/scan-06-opening-detected-door.jpg` — white rectangles overlay the opening with a **small white diamond at the centre**; the surrounding wall fills with a translucent quad |
| **Mechanism** | Openings are detected as first-class elements, distinct from wall surfaces. The diamond is a centre marker *[inferred: possibly also a tap target]*. |
| **Build note** | `CapturedRoom.doors` / `.windows` / `.openings`. Render the marker during capture so the user can see what was and wasn't caught. |

---

### INT-S06 — Detected-object rail

| | |
|---|---|
| **Before** | `screens/scan-07-scanning-3d-pill.jpg` |
| **Action** | None observed — never expanded on camera |
| **After** | — |
| **Mechanism** | A small floating card sits at the right edge with an icon and a `<` chevron: a collapsed stack of detections. Contents and behaviour unknown. |
| **Build note** | Open question. A confirm/reject list for detected objects would be useful; whether theirs does that is unverified. |

---

### INT-S07 — Incompleteness warning

| | |
|---|---|
| **Before** | `screens/scan-07-scanning-3d-pill.jpg` — normal scanning |
| **Action** | Continue scanning with the polygon still open; or approach the stop control *[inferred trigger]* |
| **After** | `screens/scan-08-incomplete-finish-anyway.jpg` — a light popover anchored above the stop button: **"Your room might be incomplete…"** with a **`Finish Anyway`** button |
| **Mechanism** | Pre-emptive warning *during* capture, before the user commits. Two-stage safety: warn here, explain at Review Scan. `Finish Anyway` is an explicit override, not the default path. |
| **Build note** | Copy this. Catching an open polygon while the user is still standing in the room is worth far more than catching it after they've left. |

---

### INT-S08 — Stop

| | |
|---|---|
| **Before** | `screens/scan-08-incomplete-finish-anyway.jpg` |
| **Action** | Tap the red stop square (or `Finish Anyway`) |
| **After** | `screens/scan-09-review-scan.jpg` — Review Scan sheet |
| **Mechanism** | Ends the room's capture and runs closure/validation before anything is persisted. |
| **Build note** | Nothing writes to the model until Confirm. Treat the captured room as a draft through this step. |

---

### INT-S09 — Review Scan

| | |
|---|---|
| **Before** | `screens/scan-08-incomplete-finish-anyway.jpg` |
| **Action** | Stop the scan |
| **After** | `screens/scan-09-review-scan.jpg` |
| **Mechanism** | Sheet contents, top to bottom: title `Review Scan`; a green circle-check with a **warning badge** on its lower right; bold **"Room scan complete, but…"**; grey body naming the room and stating the remedy; a dark preview card with the polygon filled green and the **inferred closing edge drawn as a dashed/hatched line**; blue `Confirm Scan`; red `Discard & Rescan`. |
| **Build note** | Showing *which* edge was guessed, dashed, is the right call — it tells the user exactly what to distrust. |

Body copy, verbatim:

> *"'Kitchen' had an opening. To prevent data loss, we tried to close the room shape as shown below."*

---

### INT-S10 — Confirm

| | |
|---|---|
| **Before** | `screens/scan-09-review-scan.jpg` |
| **Action** | Tap `Confirm Scan` |
| **After** | `screens/scan-10-scan-another-room.jpg` — back to camera; `Done` appears **top-left**; the mini-map shows the **completed footprint as a filled green polygon**; chip changes to **"Scan another room"**; red button remains |
| **Mechanism** | Multi-room is a loop inside one session — you never return to the method chooser between rooms. `Done` exits the loop. |
| **Build note** | `RoomBuilder` / `CapturedStructure` (iOS 17+) handles the stitching. Model the session as an explicit state machine; the loop is the part that gets messy otherwise. |

---

### INT-S11 — Reject and rescan

| | |
|---|---|
| **Before** | `screens/scan-09-review-scan.jpg` |
| **Action** | Tap `Discard & Rescan` (red, directly under `Confirm Scan`) |
| **After** | Not captured — the recording takes the Confirm path |
| **Mechanism** | Discards the draft and restarts capture for that room. *[inferred]* returns to calibration. |
| **Build note** | **This is the entry I got wrong earlier.** The reject path exists and is correctly placed: destructive action present but visually subordinate to the primary. Copy the hierarchy — blue filled primary, red text-only secondary. |

---

### INT-S12 — Room type, after the fact

| | |
|---|---|
| **Before** | `screens/scan-10-scan-another-room.jpg` |
| **Action** | Tap `Done` |
| **After** | `screens/scan-11-room-type-residential.jpg` — `Select Room Type` sheet: segmented `Residential | Commercial`, six common types, blue `See more` |
| **Mechanism** | **Opposite order to the manual paths.** Draw Room and Add Square Room ask for type *before* creating geometry; Auto-Scan captures first and classifies after. Sensible: during a scan you are holding a phone and walking. |
| **Build note** | Same component, two orderings. Don't hard-wire type selection into room creation. |

---

### INT-S13 — Commercial types

| | |
|---|---|
| **Before** | `screens/scan-11-room-type-residential.jpg` |
| **Action** | Tap `Commercial` |
| **After** | `screens/scan-12-room-type-commercial.jpg` — Private Office, Shared Office, Meeting Room, Conference Room, `See more` |
| **Mechanism** | Two disjoint vocabularies behind one control. |
| **Build note** | For personal use, ship Residential only. Keep the enum extensible. |

---

### INT-S14 — Second room

| | |
|---|---|
| **Before** | `screens/scan-10-scan-another-room.jpg` |
| **Action** | Tap the red button again |
| **After** | `screens/scan-13-calibrate-second-room.jpg` — calibration prompt again, **"Point camera at top edge of wall"** |
| **Mechanism** | Each room re-calibrates. The previous room's geometry is retained in the session. |
| **Build note** | Per-room calibration is also where relative placement is established — expect drift between rooms and plan for a stitching correction pass. |

---

### INT-S15 — Configure Floor Plan

| | |
|---|---|
| **Before** | `screens/scan-13-calibrate-second-room.jpg` → scanning → `Done` |
| **Action** | Finish the session |
| **After** | `screens/scan-14-configure-floor-plan.jpg` — sheet titled `Configure Floor Plan`, `✕` top-left |
| **Mechanism** | A pre-generation gate. Contents: **Include Objects** with three checkboxes — `Plumbing Fixtures` (*"Like Bathtub, Sink, Toilet, etc."*), `Appliances` (*"Like Oven, Dishwasher, etc."*), `Furniture` (*"Like Sofa, Bed, Table, Chair, etc."*), all checked; a **`Remember my choices`** toggle, on; a **Session Replay** group with a `Save Video recording` toggle, off; and a blue `Generate Floor Plan` button. |
| **Build note** | The object categories map onto RoomPlan's detected object types. Filtering at generation time rather than deleting afterwards is the right shape — most people scanning a room do not want the sofa in their plan. |

---

### INT-S16 — Video consent

| | |
|---|---|
| **Before** | `screens/scan-14-configure-floor-plan.jpg` |
| **Action** | Toggle `Save Video recording` on |
| **After** | `screens/scan-15-save-videos-consent.jpg` — modal **"Save videos of your scan?"** |
| **Mechanism** | Body: *"magicplan can save videos of your room scans to help with documentation and dispute resolution. Videos may include surroundings, so ensure permission before recording."* Two actions: blue `Continue without videos`, grey `Save videos`. **The privacy-preserving option is the visually primary one.** |
| **Build note** | Note the defaulting: the toggle is off, and even after switching it on the confirm dialog leads with declining. If we ever store scan video, copy that posture exactly. |

---

### INT-S17 — Result: 2D

| | |
|---|---|
| **Before** | `screens/scan-14-configure-floor-plan.jpg` |
| **Action** | Tap `Generate Floor Plan` |
| **After** | `screens/scan-16-result-2d.jpg` — the standard 2D editor, `1st Floor`, room drawn with thick black wall bands, grey fill, centred `Kitchen` + area, a **quarter-circle door swing arc**, and window openings as breaks in the wall band. Bottom `+ Insert`; hint *"Swipe up for 1st Floor info"* |
| **Mechanism** | No separate "scanned room" type — output becomes an ordinary editable room immediately. |
| **Build note** | Correct architecture: one geometry model, several ways to populate it. Scan, draw and template all converge on the same `Room`. |

---

### INT-S18 — Result: 3D

| | |
|---|---|
| **Before** | `screens/scan-16-result-2d.jpg` |
| **Action** | View-mode stepper → `3D View` |
| **After** | `screens/scan-17-result-3d.jpg` — `1st Floor / 3D View • Read Only`, extruded room with the door and windows rendered in the walls |
| **Mechanism** | Read-only: the bottom action bar is gone. |
| **Build note** | Nearly free from RoomPlan's USDZ. Cut from v1 per `MVP.md`, cheap to add in v1.1. |

---

### INT-S19 — Result: wall elevation

| | |
|---|---|
| **Before** | `screens/scan-16-result-2d.jpg` |
| **Action** | Enter a room, switch to Elevation (or double-tap a wall) |
| **After** | `screens/scan-18-wall-elevation.jpg` — `< 2D`, title `Wall`, subtitle `1st Floor`; the wall face straight on with side walls folded away in perspective; length dimension below; **circular `←` and `→` buttons at mid-left and mid-right**; `+ Insert` |
| **Mechanism** | The arrows step through the floor's walls in order, turning inspection into a linear pass rather than hunt-and-tap. |
| **Build note** | Small, cheap, genuinely good. Worth adding whenever elevation lands. |

---

## What RoomPlan gives you vs what you build

| Observed | Source |
|---|---|
| Coaching, edge tracing, surface planes | `RoomCaptureView` |
| Door / window / opening detection | `CapturedRoom.doors`, `.windows`, `.openings` |
| Object detection + the three categories in INT-S15 | `CapturedRoom.objects` |
| Multi-room chain | `RoomBuilder` / `CapturedStructure`, iOS 17+ |
| **2D mini-map with pose cursor** | **build it** |
| **Incompleteness warning (INT-S07)** | **build it** |
| **Review Scan + Discard & Rescan** | **build it** |
| **Tips gate, room-type prompt, Configure Floor Plan** | **build it** |

Verify the API surface against current Apple documentation before relying on it — that mapping
is from knowledge, not from a document read today.

Do not persist `CapturedRoom` as the schema. Map it into the model in `MVP.md` §2 at import;
Apple's type has no representation for manual edits or dimension locks.

## Open questions

1. Contents and behaviour of the detected-object rail (INT-S06).
2. Exact trigger for the incompleteness warning (INT-S07) — timer, geometry test, or proximity to stop.
3. What `Discard & Rescan` returns to (INT-S11) — calibration, or straight to scanning.
4. Whether the opening diamond (INT-S05) is interactive.
5. Manual-Scan entirely — "Scan one room. Manual object detection." The manual object step is unseen.
6. The non-LiDAR `Detect Corners` engine (App Preferences → AR "Room Scan" Mode).
