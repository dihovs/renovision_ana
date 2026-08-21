# Guiding a technician through a loss

**Status:** proposal, nothing built. Asked for by the owner 21 Aug 2026 as a
brainstorm — *"I don't wanna implement it right now… you know better, please
go and figure it out and let me know what is the best option."*

His problem, in his words: a new employee *"they do construction, but they
don't know how to do floor plan or reporting."* They mark an area as water
damage and do not know what to check next. He wants the app to tell them —
and he was explicit about the constraint: *"I don't want this to be too much
intrusive and too much involved."*

---

## 1. The recommendation in one line

**A checklist the job writes for itself, not an assistant that talks.**

Marking a wall as water damage adds four items to that job's list. Taking the
reading ticks one off. Nothing blocks, nothing pops up, and there is exactly
one prompt in the whole flow — when the technician says they are leaving.

## 2. This should mostly not be AI, and that is the point

The obvious build is a chat assistant that answers "what do I do now". It is
the wrong build, for four reasons that are worth stating because they are the
reason to spend the money on rules instead.

**It has to be the same answer every time.** A checklist that varies between
two technicians on the same kind of loss is not a checklist. On a claim, the
difference between a defensible file and one an adjuster picks apart is that
the same procedure was followed each time and can be shown to have been.

**It has to work in a basement.** Half this work happens where there is no
signal. The owner has already had this ruled his way once, on photo upload:
the queue writes to disk and sends later. Guidance that needs a round trip is
guidance that vanishes exactly where the job is hardest.

**It has to be auditable.** When a carrier asks why four dehumidifiers ran for
six days, the answer has to be *"S500, Class 2, 3,400 ft³"*. It cannot be
*"the assistant suggested it."*

**The knowledge already exists and is not ours to invent.** Water restoration
has a written standard — IICRC S500 — with categories, classes, a dry
standard and a monitoring cadence. The value here is not generating advice. It
is surfacing an agreed procedure at the moment it is needed. That is a lookup
table, and a lookup table is cheap, instant, offline and testable.

**Where AI does earn its place** — three places, all narrow:

1. **Reading the meter from a photograph.** His own idea, and the best one in
   the brainstorm: photograph the hygrometer, and the number comes off the
   screen. Genuinely hard with rules, genuinely useful — it removes typing
   from somebody on a ladder in gloves.
2. **The note polisher**, which already exists.
3. **Explaining an item in plain language** when somebody taps "why?". Canned
   text would do; this only needs a model if he wants it to answer follow-ups.

Everything else is a rules table.

## 3. Why a checklist and not prompts

Ranked by how much they get in the way:

| | |
|---|---|
| **A wizard** that walks you through steps | Rejected. The main user is the owner, who knows the job. A wizard punishes the expert to teach the novice. |
| **A prompt after every action** | Rejected, same reason, plus prompt fatigue: the third modal is dismissed without reading, and so is the one that mattered. |
| **A list the job builds itself** | **This.** Nothing blocks. Outstanding work is visible when looked at and silent when not. |
| **Warn only at export** | Too late — the technician is already home. Good as a *backstop*, not as the mechanism. |

### The two ideas that make it non-intrusive

**The list is derived, never authored.** Nobody fills in a form. Marking water
damage on a wall is itself the trigger that adds *"reading on this wall"*,
*"reading on an unaffected wall of the same material"*, *"photograph the
source"*, *"record the water category"*. Each item deep-links to the screen
that satisfies it, and ticks itself off when the underlying record exists.
There is no separate thing to maintain, and no way for the list and the job to
disagree.

**It is the report's completeness, not a lesson.** Every item is on the list
because the report needs it. So the list is not homework — it is a live answer
to *"will this report be finished when I get back?"*. That reframing is what
makes it acceptable to an experienced operator: it is not the app teaching
him, it is the app telling him what he will otherwise have to drive back for.

**And one prompt, at one moment.** When the technician taps *Done for today* —
or when the phone leaves the site, if he wants a geofence later — a single
sheet: *"Before you leave: 2 things missing."* One interruption at the only
moment it can still be acted on.

## 4. What the rules actually say

Concrete, because the difference between this proposal and hand-waving is
whether the table can be written down. A rule is a trigger and the items it
adds.

```
water damage · any surface
  ├─ record the water category (1 / 2 / 3)
  ├─ photograph the source
  ├─ moisture reading in the affected material
  ├─ moisture reading in the SAME material, unaffected     ← the one people miss
  └─ mark where the moisture stops

water · category 2 or 3
  ├─ note the PPE used
  └─ flag materials for removal rather than drying

water · on a wall
  ├─ check behind the baseboard / in the cavity
  └─ check the ceiling of the room below                   ← where the money hides

water · day 2 onward, while equipment is on site
  ├─ one reading per affected room, daily
  └─ confirm the equipment is still running

mould · any
  ├─ photograph the extent against a scale
  └─ containment noted before disturbing it

fire / smoke
  ├─ note whether the loss is wet or dry
  └─ photograph the smoke line
```

**Why the unaffected reference reading is the example to lead with.** A
drywall meter reading of 18% means nothing on its own — some materials sit
there dry. It means something against the same wall in a dry room on the same
day. A new technician will not know that, and its absence is the single most
common reason a drying log gets argued with. One line in a table fixes it
permanently, for everybody, forever. That is the shape of the whole feature.

## 5. Guided mode

He wants this for new people and not for himself. So: a **per-user setting**,
not a per-company one.

- **Guided** — the full list, with the one-line *why* under each item. Default
  for a newly created user.
- **Standard** — outstanding items only, no explanations, no leaving-site
  sheet unless something is actually missing.

He turns his own off on day one and never sees it again. Nobody has to
negotiate about how much guidance is the right amount.

## 6. What we would build, in order

Sized so each phase is useful alone and none of it is wasted if the next never
happens.

**Phase 1 — the derived checklist.** The rules table, the job's list, the
deep-links, the leaving-site sheet, the per-user mode. No AI, no new data, no
new screens beyond the list itself. **This is most of the value**, and it is
the phase to argue about before writing any of the others.

**Phase 2 — make readings worth prompting for.** A reference reading beside
every affected reading, the daily cadence while equipment is on site, and the
dry-standard comparison. The columns already exist — `material_percent`,
`relative_humidity`, `temperature_c`, `gpp` are all in `moisture_readings`
today — so this is mostly interface.

**Phase 3 — the meter photograph.** His idea. Camera on the reading screen,
photo attached to the reading, model proposes the number, **the technician
confirms it**. Never auto-accepted: a misread digit becomes a wrong drying log
that nobody catches, and a wrong drying log is worse than a slow one. The
photograph is worth keeping even when the read fails — it is evidence of the
reading, which the number alone is not.

**Phase 4 — equipment sizing.** We already know each room's volume. S500 sizes
dehumidification from cubic footage and class, so the app can say *"3,400 ft³,
Class 2 — this many pints per day"*. Presented as a starting point with the
arithmetic shown, and the rates settable by him, because it is his licence on
the file and not ours.

## 7. Three things to get right, and one to refuse

**Never state a determination.** The item is *"record the water category"* —
never *"this is Category 1"*. The app prompts a professional to make a call;
it does not make the call. If it ever appears to, a wrong call becomes our
wrong call, and it is his RBQ licence on the report.

**Few items, all applicable.** The moment a list shows something that does not
apply, people stop reading all of it. Every item must be derived from
something actually marked on this job, and any item must be dismissible with a
reason — which is itself worth recording, because *"not applicable: no room
below"* is a fact the report can use.

**Never block the scan.** Scanning is the time-critical part, done standing up
with a customer waiting. Nothing in this feature may interrupt it.

**And what I would refuse to build:** a conversational assistant that a
technician asks what to do. It cannot be held to the standard, it cannot be
audited, it will not work in the basement where it is needed, and it invites
somebody with no training to trust an answer nobody checked. The checklist can
be shown to a carrier. A chat log cannot.
