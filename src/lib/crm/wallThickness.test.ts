import { describe, expect, it } from "vitest";
import {
  DEFAULT_WALL_THICKNESS,
  DEFAULT_WALL_THICKNESS_CONFIG,
  parseWallThicknessConfig,
  thicknessForLevel,
  WALL_ASSEMBLIES,
  footprintWithHalfWalls,
  groundSurfaces,
} from "./wallThickness";

/**
 * These figures were refused for months, on the grounds that a scan of wall
 * faces cannot know a wall's thickness. The premise changed — the operator
 * states it now — so what these tests defend is the honesty of the model
 * rather than its absence: a stated thickness in, a stated approximation out,
 * and never a number that looks more measured than it is.
 */

const room = (floorAreaSqm: number, perimeterM: number) => ({ floorAreaSqm, perimeterM });

describe("assemblies", () => {
  it("uses finished thickness, not nominal lumber", () => {
    // A 2x4 wall is 3.5" of stud plus half an inch of board each side. Anyone
    // typing "4 inches" is describing the stud, not the wall.
    expect(WALL_ASSEMBLIES.stud2x4).toBeCloseTo(4.5 * 0.0254, 6);
    expect(DEFAULT_WALL_THICKNESS.interiorM).toBe(WALL_ASSEMBLIES.stud2x4);
  });

  it("makes the exterior thicker than the partitions", () => {
    expect(DEFAULT_WALL_THICKNESS.exteriorM).toBeGreaterThan(DEFAULT_WALL_THICKNESS.interiorM);
  });
});

describe("footprintWithHalfWalls", () => {
  it("adds half the thickness around the whole perimeter", () => {
    // 4 x 3 room: 12 m², 14 m perimeter, 0.1143 m wall → 12 + 14 x 0.05715.
    expect(footprintWithHalfWalls(12, 14, WALL_ASSEMBLIES.stud2x4)).toBeCloseTo(
      12 + (14 * WALL_ASSEMBLIES.stud2x4) / 2,
      9,
    );
  });

  it("returns the clear floor when no thickness is stated", () => {
    expect(footprintWithHalfWalls(12, 14, 0)).toBe(12);
  });

  it("never grows a room by more than its walls could", () => {
    // Sanity: a 2x4 around a 4x3 room adds well under a square metre.
    const grown = footprintWithHalfWalls(12, 14, WALL_ASSEMBLIES.stud2x4);
    expect(grown - 12).toBeLessThan(1);
    expect(grown).toBeGreaterThan(12);
  });

  it("survives a room with no numbers rather than returning NaN", () => {
    expect(footprintWithHalfWalls(NaN, 14, 0.1)).toBe(0);
    expect(footprintWithHalfWalls(12, NaN, 0.1)).toBe(0);
  });
});

describe("groundSurfaces", () => {
  it("reports the clear floor unchanged", () => {
    const { withoutWalls } = groundSurfaces([room(12, 14), room(8, 12)]);
    expect(withoutWalls).toBeCloseTo(20, 9);
  });

  it("equals the clear floor for interior walls on a one-room floor", () => {
    // The reference does exactly this — 6.24 and 6.24 on a single room.
    // There are no partitions to add, so adding any would be invention.
    const { withoutWalls, withInteriorWalls } = groundSurfaces([room(6.25, 10)]);
    expect(withInteriorWalls).toBeCloseTo(withoutWalls, 9);
  });

  it("orders the three the only way they can be ordered", () => {
    const s = groundSurfaces([room(12, 14), room(8, 12)]);
    expect(s.withoutWalls).toBeLessThan(s.withInteriorWalls);
    expect(s.withInteriorWalls).toBeLessThan(s.withAllWalls);
  });

  it("grows with a thicker wall, and not otherwise", () => {
    const thin = groundSurfaces([room(12, 14), room(8, 12)], {
      interiorM: WALL_ASSEMBLIES.stud2x4,
      exteriorM: WALL_ASSEMBLIES.stud2x4,
    });
    const thick = groundSurfaces([room(12, 14), room(8, 12)], {
      interiorM: WALL_ASSEMBLIES.stud2x6,
      exteriorM: WALL_ASSEMBLIES.concrete8,
    });
    expect(thick.withAllWalls).toBeGreaterThan(thin.withAllWalls);
    // The clear floor is a measurement and must not move when an assumption does.
    expect(thick.withoutWalls).toBeCloseTo(thin.withoutWalls, 9);
  });

  it("counts a shared partition once, not twice", () => {
    // Two rooms each contributing half of the wall between them is the whole
    // point of the half-offset. Two 4x3 rooms sharing one 3 m wall add
    // 14 x t/2 + 14 x t/2 = 14t of wall between them, and the partition
    // itself is 3 x t — comfortably inside that, never double.
    const t = WALL_ASSEMBLIES.stud2x4;
    const s = groundSurfaces([room(12, 14), room(12, 14)], { interiorM: t, exteriorM: t });
    const added = s.withInteriorWalls - s.withoutWalls;
    expect(added).toBeCloseTo(14 * t, 9);
    expect(added).toBeGreaterThan(3 * t);
  });

  it("holds up on an empty floor", () => {
    const s = groundSurfaces([]);
    expect(s.withoutWalls).toBe(0);
    expect(s.withAllWalls).toBe(0);
  });
});

describe("parseWallThicknessConfig", () => {
  /**
   * The column is jsonb written by a client, so it can hold an older shape,
   * a half-written object, or nonsense. Every one of these has to produce
   * usable figures rather than an error on a job site.
   */
  it("falls back completely when there is nothing stored", () => {
    expect(parseWallThicknessConfig(null)).toEqual(DEFAULT_WALL_THICKNESS_CONFIG);
    expect(parseWallThicknessConfig(undefined)).toEqual(DEFAULT_WALL_THICKNESS_CONFIG);
    expect(parseWallThicknessConfig("2x4")).toEqual(DEFAULT_WALL_THICKNESS_CONFIG);
  });

  it("reads a stated default", () => {
    const parsed = parseWallThicknessConfig({ default: { interiorM: 0.2, exteriorM: 0.3 } });
    expect(parsed.default).toEqual({ interiorM: 0.2, exteriorM: 0.3 });
  });

  it("rejects a thickness nobody could have measured", () => {
    // 4 metres is not a wall; 0.0001 is not either. Someone typed the wrong
    // unit, and the default is safer than the number.
    const parsed = parseWallThicknessConfig({ default: { interiorM: 4, exteriorM: 0.0001 } });
    expect(parsed.default).toEqual(DEFAULT_WALL_THICKNESS);
  });

  it("keeps a good field when its neighbour is nonsense", () => {
    const parsed = parseWallThicknessConfig({ default: { interiorM: 0.2, exteriorM: "thick" } });
    expect(parsed.default.interiorM).toBe(0.2);
    expect(parsed.default.exteriorM).toBe(DEFAULT_WALL_THICKNESS.exteriorM);
  });

  it("carries per-level overrides, and drops unnamed ones", () => {
    const parsed = parseWallThicknessConfig({
      default: { interiorM: 0.1, exteriorM: 0.2 },
      byLevel: { Basement: { interiorM: 0.1, exteriorM: 0.3 }, "  ": { interiorM: 0.9 } },
    });
    expect(parsed.byLevel?.Basement.exteriorM).toBe(0.3);
    expect(Object.keys(parsed.byLevel ?? {})).toEqual(["Basement"]);
  });
});

describe("thicknessForLevel", () => {
  const config = parseWallThicknessConfig({
    default: { interiorM: 0.1143, exteriorM: 0.1778 },
    byLevel: { Basement: { interiorM: 0.1143, exteriorM: 0.2032 } },
  });

  it("uses a floor's own thickness when it has one", () => {
    // The case that motivated per-level at all: a poured foundation under
    // stud walls.
    expect(thicknessForLevel(config, "Basement").exteriorM).toBe(0.2032);
  });

  it("falls back to the project default for every other floor", () => {
    expect(thicknessForLevel(config, "Ground").exteriorM).toBe(0.1778);
    expect(thicknessForLevel(config, "2nd").exteriorM).toBe(0.1778);
  });
});
