/**
 * The guided protocol's rules — Phase 1, and deliberately nothing else.
 *
 * `Docs/Guided-Protocol-Spec.md` is the specification; this is its §2 turned
 * into data. The owner approved the direction on 21 Aug 2026:
 *
 * > *"I want my app to guide them to say, okay. Measure the humidity and then
 * > check the baseboard. If accessible, if you can remove the bit of flooring,
 * > check what's going on with the subfloor. Check the drywall, the
 * > surrounding areas, and everything."*
 *
 * **There is no interface here and there is not meant to be one yet.** The
 * plan agreed with him was the rules first, as data, with tests — because the
 * rules ARE the design. He can read this table and say "that is not how we do
 * a category 3" long before a screen exists to argue with, and changing a row
 * here costs nothing next to changing a screen built on the wrong row.
 *
 * ## The two satisfaction kinds, and why the distinction carries the feature
 *
 * - **`derived`** — a query over records that already exist. *"Take a
 *   reading"* is satisfied by a `moisture_readings` row on the room. The
 *   technician never touches the checklist; doing the work ticks the box, and
 *   deleting the reading un-ticks it. Nothing about a derived check is ever
 *   stored, precisely so the list and the job cannot drift apart.
 * - **`explicit`** — nothing in the database can prove it. *"Check behind the
 *   baseboard"* leaves no trace unless somebody says so. The tap IS the
 *   record: a dated, attributed assertion by a named person that they looked,
 *   which is a far stronger thing on a claim than the absence of a finding.
 *   *"We checked the subfloor, it was dry"* survives an argument that
 *   *"nobody wrote anything about the subfloor"* does not.
 *
 * ## Order is part of the rule
 *
 * Checks run **find the extent → prove it → respond**, because that is the
 * order the work happens in, and a checklist in the wrong order is one people
 * scroll past. `ORDER` below is not alphabetical and should not be sorted.
 */

import type { DamageType } from "./areaShapes";

/** Which face of a room an affected area sits on. Mirrors
 * `affected_areas.surface`, which is floor-or-wall only — see the spec's note
 * on ceilings, which are a separate decision and not smuggled in here. */
export type ProtocolSurface = "floor" | "wall";

/**
 * What a `derived` check looks for. Each of these is a question about records
 * that already exist somewhere else in the app.
 *
 * Kept as a closed union rather than a free-form query so the evaluator is
 * total: adding a new kind is a compile error everywhere it must be handled,
 * which is the point.
 */
export type EvidenceKind =
  /** Any photo filed against this room. */
  | "photoOnRoom"
  /** Any photo filed against this specific affected area. */
  | "photoOnArea"
  /** Any moisture reading on this room. */
  | "readingOnRoom"
  /** A reading on this room dated today — the daily monitoring check. */
  | "readingOnRoomToday"
  /** A reading explicitly flagged as a dry-material reference. */
  | "referenceReading"
  /** Two or more readings on this wall, for the wicking check: one at the
   * visible line and one above it. */
  | "twoReadingsOnWall";

export type Satisfaction =
  | {
      kind: "explicit";
      /** May be closed as "not applicable" with a reason — *"no room below"*,
       * *"not accessible without lifting finished hardwood"*. Those reasons
       * are printed, and an adjuster reads and accepts them. */
      dismissible?: boolean;
      /** Comes back every day the equipment is on site. */
      resetsDaily?: boolean;
    }
  | { kind: "derived"; evidence: EvidenceKind };

export type ProtocolCheck = {
  /** Stable id, stored in `protocol_checks.check_id`. A string rather than an
   * enum for the same reason `room_objects.kind` is one: this list will grow
   * for years and a check constraint would mean a migration each time. */
  id: string;
  /** The imperative sentence the technician reads. */
  text: string;
  /** Shown only in Guided mode. Absent where the check explains itself. */
  why?: string;
  satisfaction: Satisfaction;
  /** Shown first, and marked. Disturbing mould without containment spreads it
   * through the building; opening a wall without checking for services can
   * kill somebody. These are not ordinary list items. */
  safety?: boolean;
};

const explicit = (o: { dismissible?: boolean; resetsDaily?: boolean } = {}): Satisfaction => ({
  kind: "explicit",
  ...o,
});
const derived = (evidence: EvidenceKind): Satisfaction => ({ kind: "derived", evidence });

/** water · floor */
const WATER_FLOOR: ProtocolCheck[] = [
  {
    id: "water.source",
    text: "Photograph where the water came from",
    why: "The first thing a carrier asks, and the last thing anybody remembers to shoot",
    satisfaction: derived("photoOnRoom"),
  },
  {
    id: "water.category",
    text: "Record the water category — 1, 2 or 3",
    why: "Decides whether material can be dried in place or has to come out. Everything downstream depends on it",
    satisfaction: explicit(),
  },
  {
    id: "water.extent",
    text: "Trace how far the water went and mark where it stops",
    why: "The wet edge is rarely the visible edge",
    satisfaction: explicit(),
  },
  {
    id: "water.baseboard",
    text: "Check the baseboard on every wall touching this floor",
    why: "Water wicks into the wall from the floor; the baseboard is the cheapest place to find out",
    satisfaction: explicit(),
  },
  {
    id: "water.subfloor",
    text: "If the flooring can be lifted somewhere it will not show, look at the subfloor and photograph it",
    why: "Where the real money is, and where a missed check becomes a callback three weeks later",
    satisfaction: explicit({ dismissible: true }),
  },
  {
    id: "water.below",
    text: "Check the ceiling of the room below",
    why: "Water goes down. If there is no room below, dismiss it — that is a fact the report can use",
    satisfaction: explicit({ dismissible: true }),
  },
  {
    id: "water.reading",
    text: "Take a moisture reading in the affected material",
    satisfaction: derived("readingOnRoom"),
  },
  {
    id: "water.reference",
    text: "Take a reading in the SAME material somewhere dry",
    why: "18% means nothing on its own. It means something against the same wall in a dry room on the same day",
    satisfaction: derived("referenceReading"),
  },
];

/** water · wall */
const WATER_WALL: ProtocolCheck[] = [
  {
    id: "water.source",
    text: "Photograph where the water came from",
    satisfaction: derived("photoOnRoom"),
  },
  { id: "water.category", text: "Record the water category", satisfaction: explicit() },
  {
    id: "water.wick",
    text: "Take a reading above the visible line as well as at it",
    why: "Water climbs. The stain stops lower than the moisture does",
    satisfaction: derived("twoReadingsOnWall"),
  },
  { id: "water.baseboard", text: "Check behind the baseboard", satisfaction: explicit() },
  {
    id: "water.cavity",
    text: "Check inside the cavity and the insulation",
    why: "Insulation holds water long after the drywall face reads dry",
    satisfaction: explicit(),
  },
  {
    id: "water.otherface",
    text: "Check the other side of this wall, in the next room",
    why: "One wall, two rooms, one claim",
    satisfaction: explicit({ dismissible: true }),
  },
  {
    id: "water.floorbase",
    text: "Check the floor at the base of the wall",
    satisfaction: explicit(),
  },
  {
    id: "water.reference",
    text: "Take a reference reading in dry drywall",
    satisfaction: derived("referenceReading"),
  },
];

/**
 * Added once the category is recorded as 2 or 3.
 *
 * Conditional rather than always-on because a category 1 loss — a clean
 * supply line — does not need PPE noted or porous material flagged for
 * removal, and a checklist that asks anyway is one that teaches the operator
 * to skip rows.
 */
const WATER_CAT_23: ProtocolCheck[] = [
  { id: "water.ppe", text: "Note the PPE used", satisfaction: explicit() },
  {
    id: "water.remove",
    text: "Flag porous materials for removal rather than drying",
    why: "Category 3 does not get dried in place",
    satisfaction: explicit(),
  },
];

const FIRE: ProtocolCheck[] = [
  {
    id: "fire.wet",
    text: "Is this loss wet as well as burnt?",
    why: "Extinguishing water is a water loss on top of a fire one, and it is scoped separately",
    satisfaction: explicit(),
  },
  { id: "fire.smokeline", text: "Photograph the smoke line", satisfaction: derived("photoOnArea") },
  {
    id: "fire.adjacent",
    text: "Check the rooms next to and above this one",
    why: "Smoke travels further than heat and stains what the fire never touched",
    satisfaction: explicit(),
  },
  {
    id: "fire.hvac",
    text: "Check the HVAC returns",
    why: "The system distributes smoke through the whole building",
    satisfaction: explicit(),
  },
  {
    id: "fire.odour",
    text: "Note the odour, and where",
    why: "Odour is scoped and priced, and it is not visible in a photograph",
    satisfaction: explicit(),
  },
];

const MOULD: ProtocolCheck[] = [
  {
    id: "mould.containment",
    text: "Note containment before disturbing anything",
    why: "Disturbing mould without containment spreads it through the building",
    satisfaction: explicit(),
    safety: true,
  },
  {
    id: "mould.extent",
    text: "Photograph the extent with something in frame for scale",
    why: "Square footage is the whole of the pricing, and a photo without scale cannot prove it",
    satisfaction: derived("photoOnArea"),
  },
  {
    id: "mould.source",
    text: "Find what is keeping it wet",
    why: "Mould is a symptom. Remediate without the source and it comes back on our warranty",
    satisfaction: explicit(),
  },
  { id: "mould.cavity", text: "Check the cavity behind it", satisfaction: explicit() },
];

const IMPACT: ProtocolCheck[] = [
  {
    id: "impact.services",
    text: "Check for wiring and plumbing before opening the surface",
    satisfaction: explicit(),
    safety: true,
  },
  {
    id: "impact.structure",
    text: "Check the structure behind the surface",
    satisfaction: explicit(),
  },
  { id: "impact.extent", text: "Photograph the full extent", satisfaction: derived("photoOnArea") },
];

/**
 * Every loss, day 2 onward, while equipment is on site.
 *
 * These belong to the JOB rather than to any one patch of damage, which is
 * why `protocol_checks.area_id` is nullable — see the spec's §3.
 */
export const MONITORING: ProtocolCheck[] = [
  {
    id: "monitor.daily",
    text: "One reading per affected room today",
    satisfaction: derived("readingOnRoomToday"),
  },
  {
    id: "monitor.running",
    text: "Confirm the equipment is still running",
    satisfaction: explicit({ resetsDaily: true }),
  },
];

/** Context that switches conditional checks on. */
export type ProtocolContext = {
  /** 1, 2 or 3 once recorded; `null` until the technician says. */
  waterCategory?: 1 | 2 | 3 | null;
  /** Answer to `fire.wet` — a fire loss that was extinguished with water is
   * also a water loss, and gets the water checks on top of its own. */
  fireAlsoWet?: boolean;
};

/**
 * The checks for one affected area, in the order they should be worked.
 *
 * Safety checks are hoisted to the front regardless of where they sit in
 * their own table — `mould.containment` is not a row you meet halfway down a
 * list, and `impact.services` is the difference between opening a wall and
 * opening a live circuit.
 */
export function checksFor(
  cause: DamageType,
  surface: ProtocolSurface,
  context: ProtocolContext = {},
): ProtocolCheck[] {
  let checks: ProtocolCheck[];
  switch (cause) {
    case "water":
      checks = surface === "wall" ? [...WATER_WALL] : [...WATER_FLOOR];
      if (context.waterCategory === 2 || context.waterCategory === 3) {
        checks = [...checks, ...WATER_CAT_23];
      }
      break;
    case "fire":
      checks = [...FIRE];
      // A wet fire loss is scoped as both. The water checks come after the
      // fire ones because the fire is why anybody is here.
      if (context.fireAlsoWet) {
        const water = surface === "wall" ? WATER_WALL : WATER_FLOOR;
        const seen = new Set(checks.map((c) => c.id));
        checks = [...checks, ...water.filter((c) => !seen.has(c.id))];
      }
      break;
    case "mould":
      checks = [...MOULD];
      break;
    case "impact":
      checks = [...IMPACT];
      break;
    case "other":
      // No rules, on purpose. "Other" means the operator has already told us
      // this does not fit a category, and inventing checks for it would be
      // guessing at work we cannot name.
      checks = [];
      break;
  }
  const safety = checks.filter((c) => c.safety);
  return [...safety, ...checks.filter((c) => !c.safety)];
}

/** Evidence the app can see, gathered once per area rather than per check. */
export type Evidence = Partial<Record<EvidenceKind, boolean>>;

/** A stored `protocol_checks` row, reduced to what completion needs. */
export type StoredCheck = {
  checkId: string;
  status: "done" | "not_applicable";
  reason?: string | null;
  /** For checks that reset daily. `null` for the rest. */
  appliesOn?: string | null;
};

export type CheckState = {
  check: ProtocolCheck;
  status: "done" | "not_applicable" | "open";
  reason?: string | null;
  /** True when this was satisfied by a record rather than by a tap — the
   * report says so, because "the reading proves it" and "somebody said so"
   * are different strengths of evidence. */
  bySystem: boolean;
};

/**
 * Resolve every check to done / not-applicable / open.
 *
 * **A derived check ignores stored rows entirely.** If a reading satisfies
 * `water.reading`, that is the answer; if the reading is later deleted the
 * check re-opens on its own. Letting a stored row override would be exactly
 * the drift this design exists to prevent — a checklist claiming done when
 * the record behind it is gone is worse than no checklist.
 *
 * `today` is passed in rather than read from the clock so this stays pure and
 * the daily-reset behaviour is testable. Format is `YYYY-MM-DD`.
 */
export function evaluate(
  checks: ProtocolCheck[],
  evidence: Evidence,
  stored: StoredCheck[],
  today: string,
): CheckState[] {
  return checks.map((check) => {
    if (check.satisfaction.kind === "derived") {
      return {
        check,
        status: evidence[check.satisfaction.evidence] ? "done" : "open",
        bySystem: true,
      };
    }
    const resets = check.satisfaction.resetsDaily === true;
    const row = stored.find(
      (s) => s.checkId === check.id && (!resets || s.appliesOn === today),
    );
    return {
      check,
      status: row ? row.status : "open",
      reason: row?.reason ?? null,
      bySystem: false,
    };
  });
}

/**
 * What is still open, for the one sheet shown when the technician says they
 * are leaving.
 *
 * **Nothing blocks.** This names what is outstanding; it never prevents
 * leaving. A protocol that stops somebody driving away is a protocol that
 * gets switched off.
 */
export function outstanding(states: CheckState[]): CheckState[] {
  return states.filter((s) => s.status === "open");
}
