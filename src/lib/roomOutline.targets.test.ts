import { describe, expect, it } from "vitest";
import { toFloorPlan } from "./roomScan";
import { CASES, CLEAN, ROUGH, TYPICAL, realCorners, score, toScan, type Noise, type RoomCase } from "./roomOutline.fixtures";

/**
 * What the room outline must do, against hand-measured rooms (owner,
 * 3 Nov 2026). See roomOutline.fixtures.ts for the rooms and the noise.
 *
 * Two kinds of test below.
 *
 *   `it` — holds today and must keep holding.
 *
 *   `it.fails` — what the outline gets WRONG today, written as the behaviour
 *   we want. Vitest reports these as passing while they still fail, and
 *   turns red the day a fix makes one pass — which is the signal to change
 *   it to a plain `it`. The scorecard of 3 Nov 2026 (roomOutline.scorecard
 *   .test.ts) is where each one comes from.
 *
 * The area bar is NOT "within 1 % of the tape". A real scan's walls are a few
 * centimetres off on their own, and on a 12' room ±3 cm per wall is already
 * ±2 % of area before any code runs. The scorecard measures that floor
 * directly (the same noisy walls joined by something that already knows the
 * room); the outline is judged against it, so these tests fail only for
 * error that is ours.
 */

const SEEDS = 50;
const byName = (part: string): RoomCase => {
  const room = CASES.find((c) => c.name.includes(part));
  if (!room) throw new Error(`no case ${part}`);
  return room;
};

function run(room: RoomCase, noise: Noise) {
  return Array.from({ length: SEEDS }, (_, i) => score(toFloorPlan(toScan(room, noise, i + 1)).polygon, room));
}

describe("clean walls: every shape comes out exactly", () => {
  for (const room of CASES) {
    it(room.name, () => {
      for (const s of run(room, CLEAN)) {
        expect(s.closed).toBe(true);
        expect(s.corners).toBe(room.corners);
        expect(s.areaErrPct).toBeLessThan(1);
        expect(s.perimeterErrPct).toBeLessThan(0.5);
        expect(s.worstAngleDeg).toBeLessThan(0.5);
      }
    });
  }
});

describe("typical scan noise: simple shapes close, square, with the right corners", () => {
  for (const part of ["Rectangle", "L-shape", "open 6'", "45°"]) {
    it(byName(part).name, () => {
      const room = byName(part);
      for (const s of run(room, TYPICAL)) {
        expect(s.closed).toBe(true);
        expect(s.corners).toBe(room.corners);
      }
    });
  }
});

describe("known failures, 3 Nov 2026 — flip to `it` as each is fixed", () => {
  it.fails("a closet built into a corner: the room still closes (7 of 50 typical scans do not)", () => {
    const room = byName("built into a corner");
    for (const s of run(room, TYPICAL)) expect(s.closed).toBe(true);
  });

  it.fails("a 1' chimney chase keeps square corners (one comes out 21° off today)", () => {
    const room = byName("chimney chase");
    for (const s of run(room, TYPICAL)) expect(s.worstAngleDeg).toBeLessThan(1);
  });

  it.fails("a wall in two pieces plus a door-frame stub: every shape keeps its corner count", () => {
    for (const room of CASES) {
      for (const s of run(room, ROUGH)) expect(s.corners).toBe(room.corners);
    }
  });

  it.fails("a wall in two pieces plus a door-frame stub: square corners stay square (4–11° off today)", () => {
    for (const room of CASES.filter((c) => !c.name.includes("45°"))) {
      for (const s of run(room, ROUGH)) if (s.closed) expect(s.worstAngleDeg).toBeLessThan(1);
    }
  });
});

describe("the scorer itself", () => {
  it("drops the closing repeat and straight-through points", () => {
    const loop = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 1 },
      { x: 0, y: 1 },
      { x: 0, y: 0 },
    ];
    expect(realCorners(loop)).toHaveLength(4);
  });
});
