# Start here

One door into everything. If you are an agent opened in this repo, read this file first, then
`ORDERS.md`.

**What to do:** `../ORDERS.md` — twelve sequenced work orders. One at a time. Commit per
order, prefixed with the id. If an order's premise turns out to be wrong, stop and report;
do not improvise a substitute.

**What is already built:** `REFERENCE-STATUS.md` — this source audited against the magicplan
reference. BUILT 12 / PARTIAL 16 / ABSENT 25, every claim citing a file and symbol. Check here
before building anything; several things that look missing are already done.

---

## Which document wins

There are two generations of magicplan research in this repo. They overlap. Where they
disagree, use this table — it is ordered by how the knowledge was obtained, and direct
observation beats inference.

| Question | Authority | Why |
|---|---|---|
| In what **order** does the capture flow run, and what happens after a real scan | `reference/magicplan/owner-walkthrough.md` | The owner ran a real scan on his own phone and narrated it. The only material covering a scan of an actual room and the editing that follows |
| What does magicplan's UI actually *do* — screens, taps, state changes | `reference/magicplan/interactions-*.md` (88 entries, `INT-S*` / `INT-E*` / `INT-P*`) | Observed on device, screenshot-cited before and after each action |
| What does the LiDAR scan flow do | `reference/magicplan/interactions-scan.md` | Frame-by-frame from a native-resolution screen recording |
| What should our report/PDF contain and look like | `Report-Estimate-Blueprint.md` | Reverse-engineered from the client's real 20-page magicplan export. **Stronger than anything in `reference/`** — that is a real artefact, not an observation of a UI |
| How should the plan renderer draw walls, openings, dimensions | `FloorPlan-Renderer-Spec.md` | Deliberate design work with sourced drafting convention |
| How should plan editing behave on iPhone | `Interactive-Plan-Editor-Spec.md` | Design decision, grounded in several shipping editors |
| What does magicplan's *web* app do | `Magicplan-Workflow.md` | Observed in cloud.magicplan.app. Complements `reference/`, which is iOS |
| Overall screen chain and data rules to build toward | `Magicplan-Screen-Spec.md` | Self-described as "a model to build against, not a description of our current app" — a target, not evidence |
| What is true of **our** code right now | `REFERENCE-STATUS.md` | Read from the source on branch `mobile-app` |

**Rule of thumb:** `reference/` says what magicplan *does*. The older `Magicplan-*.md` specs
say what we *should build*. When they conflict on a fact about magicplan, `reference/` wins.
When they conflict on a decision about our product, the spec wins — `reference/` is not a
mandate to copy.

**Stale, kept only for its screenshots:** `reference/PHONE-BUILD-AUDIT.md`. It audited a
shipped build older than this source and is wrong on ten points. `REFERENCE-STATUS.md`
supersedes it. Same for `reference/PLAN-superseded.md` and `reference/BUILD-superseded.md`,
which assumed a SwiftUI/SwiftData app built from nothing.

---

## The reference material

`reference/magicplan/`

| File | Contents |
|---|---|
| `owner-walkthrough.md` | The owner's own narrated session, Aug 2026. Capture order, floor/room/wall/opening selection depths, the measurement panel, units, elevation. **Every claim tagged `[seen]` / `[owner]` / `[owner-unsure]`** — respect the tags |
| `interactions-scan.md` | 19 entries — LiDAR capture, from a 2:50 recording. Authoritative for anything scan-related |
| `interactions-editor.md` | 34 entries — editor, measurement entry, objects, elevation |
| `interactions-project.md` | 35 entries — projects, statistics, export, settings |
| `spec.md` | 643-line structural reference. §3 measurement definitions, §9 screenshot index |
| `scan-flow-brief.md` | Earlier scan draft. Partly superseded — see its header |
| `screens/` | 106 screenshots, semantic filenames |

`reference/phone-build-screens/` — 13 screenshots of our own shipped app, Aug 2026.

Interaction entries follow one format: **Before** (screenshot) → **Action** → **After**
(screenshot) → **Mechanism** → **Build note**. Cite `INT-xx` ids when discussing behaviour.

**Open screenshots on demand, a few at a time.** Never read the whole `screens/` directory
into context; `spec.md` §9 indexes it.

---

## Two things that are verified — do not re-derive

**Wall area here is interior perimeter × ceiling height** (`src/lib/roomScan.ts:299`). That is
correct for paint, drywall and baseboard. magicplan uses a ground perimeter distinct from its
ceiling perimeter (`reference/magicplan/spec.md` §3) — a different definition for a different
purpose. **Ours is not a bug.** What is missing is stating which definition was used;
ORD-04 covers it.

**Dimension locking is built** — `lockedEdges`, persisted, rendered, defended against
destructive drags. Do not rebuild it. The gap is the export option that consumes it (ORD-09).

---

## Known unknowns

Flag these; do not invent them.

- Whether a **freshly scanned room arrives with its dimensions already locked**. The owner
  thought so but was not sure (`owner-walkthrough.md` E5). It decides whether the
  "only manually set dimensions" export prints anything at all on a scanned room.
- **How a damage rectangle is drawn in elevation** — the gesture, resizing, snapping. Described
  in words, never captured (`owner-walkthrough.md` G6).
- magicplan's **Manual-Scan** flow and the non-LiDAR "Detect Corners" engine were never observed.
  The detected-object rail is now described in `owner-walkthrough.md` A5–A7, from testimony only.
- Anything marked `[inferred]` or `[uncertain]` in the reference is a guess.
- `REFERENCE-STATUS.md` marks items "unverified" where the source could not settle them.

---

## What we do not copy

Workflow, information architecture and interaction patterns: reuse freely. Icon set, 3D object
renders, illustrations and trade dress: do not copy — treat a described icon as a functional
requirement ("doors need a plan-view glyph showing swing direction") and draw our own. Quoted
copy is for behavioural precision, not strings to ship.
