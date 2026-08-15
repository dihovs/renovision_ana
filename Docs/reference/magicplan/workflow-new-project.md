# New Project → first room: the observed chain

**Source:** walked end to end on the owner's own device, 14 Aug 2026, via iPhone
Mirroring. Every screen below was seen, not inferred. This supersedes guesses in
`scan-flow-brief.md` about how a project begins, and fills the documented gap on
the **Manual-Scan** entry point (the method chooser is observed; the Manual-Scan
flow *after* choosing it still is not).

---

## The chain

```
Projects grid
  └─ "New Project" (dashed tile, first in grid)
       └─ project created IMMEDIATELY — no form, no dialog
            └─ Project screen
                 ├─ Add project description…        (inline, pencil)
                 ├─ Address card                    (Address Line #1 / City, State / Postal Code)
                 ├─ Forms                            ›
                 ├─ Statistics    › See All          (0.00 m² · 0.00 m² · 0 · 0 when empty)
                 ├─ Floor Plans   › See All          "Create, edit and share floor plans."
                 │    └─ "+"  →  Add Floor
                 │                 ├─ Most common:  Ground, 1st, 2nd, 3rd, 4th
                 │                 └─ Other floors: Basement • Level 3 / 2 / 1,
                 │                                  Land survey, Semi-Basement,
                 │                                  Higher Ground Floor, 5th … 9th+
                 │         └─ lands DIRECTLY on the empty floor canvas
                 │              ├─ nav: ‹▣ pill · "Ground Floor" · ? · share
                 │              ├─ undo/redo pill · layers stepper · 2D stepper
                 │              ├─ dotted grid, empty
                 │              └─ action bar: one full-width "+ Insert"
                 │                   └─ Insert → Room · Object · Note · Photo · Form
                 │                        └─ Room → "Add Room — Choose a method"
                 │                             ├─ Auto-Scan    [LiDAR]  "Scan multiple rooms. Auto object detection."
                 │                             ├─ Manual-Scan  [LiDAR]  "Scan one room. Manual object detection."
                 │                             ├─ Add Square Room       "Start with a template. Then tweak the shape."
                 │                             ├─ Draw Room             "Add corner points to build the room shape."
                 │                             └─ Import & Draw         "Trace over an image of an existing plan."
                 └─ Photos        › See All          "Add photos and share reports."
```

---

## What is worth taking

**Creation is instant.** The single most important observation. No form stands
between wanting a project and having one. Everything a form would have asked
(name, address, description) is editable on the project screen afterwards.
Implemented — see `ProjectsView.createNow()`.

**The floor is a first-class object.** You do not add a room to a project; you
add a *floor*, land on that floor's canvas, and insert a room into it. Our
capture flow asks for the floor as one field in a chain and never lands the
operator on a floor as a place.

**Insert is one verb with five nouns.** Room, Object, Note, Photo, Form — the
same menu at floor level and at wall level (seen earlier in the editor). Ours
has separate entry points per kind.

**Five ways to make a room, not two.** We have auto-scan, sketch and typed
dimensions. Missing: a square-room template to tweak, and **Import & Draw** —
tracing over a photo of an existing plan. For insurance work that last one is
strong: the builder's plan or the adjuster's sketch is often the only source
for a floor nobody can scan.

---

## What NOT to take

**Their floor ordering.** "Most common" is Ground + 1st–4th; every basement is
filed under "Other floors". That is an appraiser's ordering. A water-damage
restoration company works in basements more than any other storey, so ours
keeps Basement in the common set — see `COMMON_FLOOR_IDS` in
`src/lib/crm/floors.ts`. This is a deliberate divergence, not an oversight.

**Their empty state.** `0.00 m² · 0.00 m² · 0 · 0` is four zeroes where a new
operator most needs to be told what to do first.

---

## Still not observed

- Manual-Scan *after* the method is chosen (the chooser is now observed; the
  flow behind it is not).
- Add Square Room, Draw Room and Import & Draw beyond their one-line
  descriptions.
- Forms — the row exists on every project and its contents are unknown.
- What the `…` affordance on each grid card opens.
