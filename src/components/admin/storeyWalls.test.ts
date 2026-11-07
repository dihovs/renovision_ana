import { describe, expect, it } from "vitest";
import { runs, runsPath } from "./storeyWalls";

const rect = (x: number, y: number, w: number, h: number) => [
  { x, y },
  { x: x + w, y },
  { x: x + w, y: y + h },
  { x, y: y + h },
];
const I = 0.1143;
const E = 0.1778;

describe("storeyWalls — one wall per pair of facing edges", () => {
  it("a room alone gets the exterior width all round", () => {
    const r = runs(0, [rect(0, 0, 4, 3)], { x: 0, y: 0 }, I, E);
    expect(r).toHaveLength(4);
    for (const run of r) {
      expect(run.kind).toBe("exterior");
      expect(run.far).toBeCloseTo(E);
      // Square outside corners: each end runs on by the other wall's width.
      expect(run.pastA).toBeCloseTo(E);
      expect(run.pastB).toBeCloseTo(E);
    }
  });

  it("two rooms a partition apart share ONE wall that fills the gap", () => {
    const floor = [rect(0, 0, 3, 3), rect(3 + I, 0, 3, 3)];
    const left = runs(0, floor, { x: 0, y: 0 }, I, E);
    const shared = left.filter((r) => r.kind === "partition");
    expect(shared).toHaveLength(1);
    expect(shared[0].near).toBe(0);
    expect(shared[0].far).toBeCloseTo(I);
    const right = runs(1, floor, { x: 3 + I, y: 0 }, I, E);
    expect(right.filter((r) => r.kind === "partition")[0].far).toBeCloseTo(I);
  });

  it("two rooms 6 cm apart draw one partition centred in the gap, not two", () => {
    const floor = [rect(0, 0, 3, 3), rect(3.06, 0, 3, 3)];
    const left = runs(0, floor, { x: 0, y: 0 }, I, E).find((r) => r.kind === "shared")!;
    expect(left.near).toBeCloseTo(0.03 - I / 2);
    expect(left.far).toBeCloseTo(0.03 + I / 2);
  });

  it("an edge half against a neighbour splits into partition and exterior", () => {
    const floor = [rect(0, 0, 3, 4), rect(3 + I, 0, 3, 2)];
    const right = runs(0, floor, { x: 0, y: 0 }, I, E).filter((r) => Math.abs(r.a.x - 3) < 1e-9 && Math.abs(r.b.x - 3) < 1e-9);
    expect(right.map((r) => r.kind).sort()).toEqual(["exterior", "partition"]);
  });

  it("an open side gets no wall", () => {
    const r = runs(0, [rect(0, 0, 4, 3)], { x: 0, y: 0 }, I, E, (a, b) => a.y === 3 && b.y === 3);
    expect(r).toHaveLength(3);
  });

  it("a door is cut out of its run and reports the wall's faces", () => {
    const r = runs(0, [rect(0, 0, 4, 3)], { x: 0, y: 0 }, I, E);
    const { d, faces } = runsPath(r, [{ x1: 1, y1: 0, x2: 1.8, y2: 0 }]);
    expect(faces[0]).not.toBeNull();
    expect(faces[0]!.far).toBeCloseTo(E);
    // Four walls, one of them in two pieces.
    expect(d.match(/M /g)).toHaveLength(5);
  });
});
