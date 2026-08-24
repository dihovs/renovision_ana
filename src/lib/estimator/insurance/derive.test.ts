import { describe, expect, it } from "vitest";
import type { AffectedArea } from "../../crm/areaShapes";
import type { EquipmentPlacement, MoistureReading } from "../../crm/dryingLog";
import type { RoomObject } from "../../crm/roomObjects";
import { GENERAL_CONDITIONS, applyMinimumCharges, deriveLines, mergeLines } from "./derive";
import type { EstimateContext, EstimateLine, EstimateRoom } from "./types";
import { mToLinFt, sqmToSqFt } from "./units";

// ---------------------------------------------------------------------------
// Fixtures

function area(partial: Partial<AffectedArea>): AffectedArea {
  return {
    id: "area-1",
    created_at: "2026-08-20T10:00:00Z",
    room_scan_id: "room-1",
    surface: "floor",
    wall_index: null,
    name: "Affected area",
    damage_type: "water",
    color: null,
    area_sqm: 2,
    polygon: [],
    notes: null,
    show_dimensions: false,
    ...partial,
  };
}

function object(partial: Partial<RoomObject>): RoomObject {
  return {
    id: "obj-1",
    roomScanId: "room-1",
    kind: "toilet",
    name: null,
    x: 0,
    y: 0,
    rotation: 0,
    width: 0.7,
    depth: 0.4,
    height: 0.75,
    disposition: "none",
    included: true,
    quantity: 1,
    sizeHandSet: false,
    notes: null,
    ...partial,
  };
}

function room(partial: Partial<EstimateRoom>): EstimateRoom {
  return {
    roomScanId: "room-1",
    name: "Salle de bain",
    stats: {
      level: "Ground",
      floorAreaSqm: 5,
      perimeterM: 9,
      ceilingHeightM: 2.4,
      wallAreaGrossSqm: 21.6,
      wallAreaNetSqm: 19.2,
      doorCount: 1,
      windowCount: 1,
    },
    wallLengthsM: [2.5, 2, 2.5, 2],
    baseboardLengthM: 8.1, // 9 m perimeter minus one 0.9 m doorway
    floorFinish: "laminate",
    affectedAreas: [],
    objects: [],
    ...partial,
  };
}

function context(partial: Partial<EstimateContext>): EstimateContext {
  return {
    rooms: [],
    equipment: [],
    readings: [],
    asOf: new Date("2026-08-23T12:00:00Z"),
    ...partial,
  };
}

function placement(partial: Partial<EquipmentPlacement>): EquipmentPlacement {
  return {
    id: "eq-1",
    created_at: "2026-08-20T10:00:00Z",
    project_id: "project-1",
    room_scan_id: "room-1",
    kind: "LGR dehumidifier",
    identifier: null,
    quantity: 1,
    in_service_at: "2026-08-20T08:00:00Z",
    out_of_service_at: "2026-08-22T16:00:00Z",
    notes: null,
    ...partial,
  };
}

function reading(partial: Partial<MoistureReading>): MoistureReading {
  return {
    id: "read-1",
    created_at: "2026-08-20T10:00:00Z",
    room_scan_id: "room-1",
    taken_at: "2026-08-20T10:00:00Z",
    location: "North wall",
    material_percent: 40,
    relative_humidity: null,
    temperature_c: null,
    gpp: null,
    material: "Drywall",
    notes: null,
    ...partial,
  };
}

const byRule = (lines: EstimateLine[], ruleId: string) =>
  lines.filter((line) => line.key.startsWith(`${ruleId}:`));

// ---------------------------------------------------------------------------

describe("floor rules", () => {
  it("removes at the measured area and installs wall to wall", () => {
    const lines = deriveLines(
      context({ rooms: [room({ affectedAreas: [area({ area_sqm: 2 })] })] }),
    );
    const replace = byRule(lines, "floor.replace");
    const removal = replace.find((line) => line.activity === "remove");
    const install = replace.find((line) => line.itemCode === "FLR-LAM-INST");

    expect(removal?.removalItemCode).toBe("DEM-LAM");
    expect(removal?.quantity).toBeCloseTo(sqmToSqFt(2), 1);
    expect(install?.quantity).toBeCloseTo(sqmToSqFt(5), 1);
    // Underlay accompanies a floating floor.
    expect(replace.some((line) => line.itemCode === "FLR-UNDERLAY")).toBe(true);
  });

  it("derives visibly instead of guessing when the finish is not recorded", () => {
    const lines = deriveLines(
      context({
        rooms: [room({ floorFinish: null, affectedAreas: [area({})] })],
      }),
    );
    const flagged = byRule(lines, "floor.replace");
    expect(flagged).toHaveLength(1);
    expect(flagged[0].issues).toContain("unknown_finish");
    expect(flagged[0].itemCode).toBeNull();
    expect(flagged[0].quantity).toBeGreaterThan(0);
  });

  it("carpet install has no book item and says so", () => {
    const lines = deriveLines(
      context({
        rooms: [room({ floorFinish: "carpet", affectedAreas: [area({})] })],
      }),
    );
    const install = byRule(lines, "floor.replace").filter(
      (line) => line.activity === "install",
    );
    expect(install).toHaveLength(1);
    expect(install[0].issues).toContain("no_item");
    expect(install[0].replaceRateCents).toBeNull();
  });

  it("baseboard follows the floor at the baseboard length, not the perimeter", () => {
    const lines = deriveLines(context({ rooms: [room({ affectedAreas: [area({})] })] }));
    const baseboard = byRule(lines, "floor.baseboard");
    // 8.1 m baseboard length — trim does not run across the doorway.
    expect(baseboard.find((line) => line.itemCode === "TRIM-BASE-INST")?.quantity).toBeCloseTo(
      mToLinFt(8.1),
      1,
    );
    // And the per-wall baseboard rule stands down.
    expect(byRule(lines, "wall.baseboard")).toHaveLength(0);
  });
});

describe("wall rules", () => {
  const wallRoom = room({
    affectedAreas: [area({ surface: "wall", wall_index: 1, area_sqm: 3 })],
  });

  it("drywall out and back as one E&R line, with tape and a 125% seal coat", () => {
    const lines = deriveLines(context({ rooms: [wallRoom] }));
    const drywall = byRule(lines, "wall.drywall");
    const er = drywall.find((line) => line.itemCode === "DW-INST-12");
    const seal = drywall.find((line) => line.itemCode === "PNT-STAINBLOCK");
    const sqft = sqmToSqFt(3);

    expect(er?.removalItemCode).toBe("DEM-DRYWALL");
    expect(er?.removeRateCents).toBe(225);
    expect(er?.replaceRateCents).toBe(425);
    expect(seal?.quantity).toBeCloseTo(sqft * 1.25, 1);
  });

  it("baseboard on the affected wall only, from that wall's length", () => {
    const lines = deriveLines(context({ rooms: [wallRoom] }));
    const baseboard = byRule(lines, "wall.baseboard");
    expect(baseboard.find((line) => line.itemCode === "TRIM-BASE-INST")?.quantity).toBeCloseTo(
      mToLinFt(2),
      1,
    );
  });

  it("repaints the room's net wall area, flagged as trimmable", () => {
    const lines = deriveLines(context({ rooms: [wallRoom] }));
    const paint = byRule(lines, "wall.paint");
    expect(paint[0].quantity).toBeCloseTo(sqmToSqFt(19.2), 1);
    expect(paint[0].note).toBeTruthy();
  });
});

describe("object rules", () => {
  it("reset derives as detach & reset with no price — the book has no such item", () => {
    const lines = deriveLines(
      context({
        rooms: [room({ objects: [object({ kind: "toilet", disposition: "reset" })] })],
      }),
    );
    const reset = byRule(lines, "object.disposition");
    expect(reset).toHaveLength(1);
    expect(reset[0].activity).toBe("detachReset");
    expect(reset[0].issues).toContain("no_item");
    expect(reset[0].replaceRateCents).toBeNull();
  });

  it("replace derives as E&R with both codes", () => {
    const lines = deriveLines(
      context({
        rooms: [room({ objects: [object({ kind: "bathtub", disposition: "replace" })] })],
      }),
    );
    const er = byRule(lines, "object.disposition")[0];
    expect(er.removalItemCode).toBe("DEM-TUB");
    expect(er.itemCode).toBe("BATH-TUB-INST");
  });

  it("cabinets bill by their measured width in linear feet", () => {
    const lines = deriveLines(
      context({
        rooms: [
          room({
            objects: [object({ kind: "base_cabinet", disposition: "remove", width: 1.2 })],
          }),
        ],
      }),
    );
    const removal = byRule(lines, "object.disposition")[0];
    expect(removal.removalItemCode).toBe("DEM-CAB-LF");
    expect(removal.unit).toBe("linear ft");
    expect(removal.quantity).toBeCloseTo(mToLinFt(1.2), 1);
  });

  it("an excluded object derives nothing — out of the claim entirely", () => {
    const lines = deriveLines(
      context({
        rooms: [room({ objects: [object({ disposition: "replace", included: false })] })],
      }),
    );
    expect(byRule(lines, "object.disposition")).toHaveLength(0);
  });

  it("protect derives a zero-value memo line, the reference's own convention", () => {
    const lines = deriveLines(
      context({
        rooms: [room({ objects: [object({ kind: "vanity", disposition: "protect" })] })],
      }),
    );
    const memo = byRule(lines, "object.disposition")[0];
    expect(memo.activity).toBe("memo");
    expect(memo.replaceRateCents).toBeNull();
  });

  it("an unrecognised kind still derives, flagged instead of guessed", () => {
    const lines = deriveLines(
      context({
        rooms: [room({ objects: [object({ kind: "aquarium", disposition: "replace" })] })],
      }),
    );
    const flagged = byRule(lines, "object.disposition")[0];
    expect(flagged.issues).toContain("no_item");
    expect(flagged.itemCode).toBeNull();
  });
});

describe("project rules", () => {
  it("equipment bills per unit-day off the drying log", () => {
    const lines = deriveLines(
      context({
        equipment: [placement({ quantity: 2 })], // Aug 20 → Aug 22 inclusive = 3 days × 2 units
      }),
    );
    const rental = byRule(lines, "drying.equipment")[0];
    expect(rental.itemCode).toBe("RST-DEHUM");
    expect(rental.quantity).toBe(6);
    expect(rental.roomName).toBe(GENERAL_CONDITIONS);
  });

  it("equipment the book cannot price derives unpriced, not silently skipped", () => {
    const lines = deriveLines(
      context({ equipment: [placement({ kind: "Air scrubber / HEPA" })] }),
    );
    const rental = byRule(lines, "drying.equipment")[0];
    expect(rental.issues).toContain("no_item");
  });

  it("one monitoring visit per distinct reading day, plus the documentation line", () => {
    const lines = deriveLines(
      context({
        readings: [
          reading({ taken_at: "2026-08-20T10:00:00Z" }),
          reading({ id: "read-2", taken_at: "2026-08-20T16:00:00Z" }),
          reading({ id: "read-3", taken_at: "2026-08-21T10:00:00Z" }),
        ],
      }),
    );
    expect(byRule(lines, "drying.monitoring")[0].quantity).toBe(2);
    expect(byRule(lines, "drying.documentation")).toHaveLength(1);
  });

  it("debris and final clean appear once per damaged job", () => {
    const lines = deriveLines(context({ rooms: [room({ affectedAreas: [area({})] })] }));
    expect(byRule(lines, "general.debris")).toHaveLength(1);
    expect(byRule(lines, "general.finalClean")).toHaveLength(1);
  });
});

describe("merge semantics (§3.1)", () => {
  it("re-running replaces derived lines and never touches manual ones", () => {
    const ctx = context({ rooms: [room({ affectedAreas: [area({})] })] });
    const first = deriveLines(ctx);
    const manual: EstimateLine = {
      ...first[0],
      key: "manual:owner-added",
      origin: "manual",
      name: "Owner-added line",
    };
    const merged = mergeLines([...first, manual], deriveLines(ctx));

    expect(merged.filter((line) => line.origin === "manual")).toHaveLength(1);
    expect(merged.filter((line) => line.key === first[0].key)).toHaveLength(1);
    expect(merged).toHaveLength(first.length + 1);
  });

  it("an edited derived line becomes manual and its successor is dropped", () => {
    const ctx = context({ rooms: [room({ affectedAreas: [area({})] })] });
    const first = deriveLines(ctx);
    const edited: EstimateLine = { ...first[0], origin: "manual", quantity: 999 };
    const merged = mergeLines([edited, ...first.slice(1)], deriveLines(ctx));

    const survivors = merged.filter((line) => line.key === edited.key);
    expect(survivors).toHaveLength(1);
    expect(survivors[0].quantity).toBe(999);
    expect(survivors[0].origin).toBe("manual");
  });
});

describe("minimum labour charges", () => {
  it("tops a trade up to its floor when its billed work falls short", () => {
    const ctx = context({
      readings: [reading({})], // RST-DOC 145,00 — Restoration category
    });
    const lines = applyMinimumCharges(deriveLines(ctx), { Restoration: 50000 });
    const minimum = lines.find((line) => line.key === "minimum:Restoration");

    expect(minimum).toBeDefined();
    // RST-DOC 145,00 + RST-MONITOR 195,00 = 340,00 billed; floor is 500,00.
    expect(minimum?.replaceRateCents).toBe(50000 - 34000);
    expect(minimum?.roomName).toBe(GENERAL_CONDITIONS);
  });

  it("stays silent for a trade that is absent or already above its floor", () => {
    const lines = applyMinimumCharges(deriveLines(context({})), {
      Restoration: 50000,
      Painting: 10000,
    });
    expect(lines.some((line) => line.key.startsWith("minimum:"))).toBe(false);
  });
});

describe("review regressions", () => {
  it("tile installs at the affected area — a patch, not a relay", () => {
    const lines = deriveLines(
      context({
        rooms: [room({ floorFinish: "tile", affectedAreas: [area({ area_sqm: 2 })] })],
      }),
    );
    const tile = byRule(lines, "floor.replace").find((l) => l.itemCode === "TILE-FLR-STD");
    expect(tile?.quantity).toBeCloseTo(sqmToSqFt(2), 1);
  });

  it("equipment lines are keyed by placement id, immune to list reordering", () => {
    const a = placement({ id: "eq-a" });
    const b = placement({ id: "eq-b", kind: "Air mover" });
    const first = deriveLines(context({ equipment: [a, b] }));
    const after = deriveLines(context({ equipment: [b] })); // a collected and deleted
    const keyB = "drying.equipment:project:eq-b";
    expect(first.some((l) => l.key === keyB)).toBe(true);
    expect(after.some((l) => l.key === keyB)).toBe(true);
    expect(after.some((l) => l.key.includes("eq-a"))).toBe(false);
  });

  it("an accessory slug is never priced as the fixture it decorates", () => {
    const lines = deriveLines(
      context({
        rooms: [
          room({ objects: [object({ kind: "toilet_roll_holder", disposition: "replace" })] }),
        ],
      }),
    );
    const line = byRule(lines, "object.disposition")[0];
    expect(line.itemCode).toBeNull();
    expect(line.removalItemCode).toBeNull();
    expect(line.issues).toContain("no_item");
  });

  it("a removed tombstone survives re-derivation", () => {
    const ctx = context({ rooms: [room({ affectedAreas: [area({})] })] });
    const first = deriveLines(ctx);
    const tombstone: EstimateLine = { ...first[0], origin: "manual", removed: true };
    const merged = mergeLines([tombstone, ...first.slice(1)], deriveLines(ctx));
    const survivors = merged.filter((l) => l.key === tombstone.key);
    expect(survivors).toHaveLength(1);
    expect(survivors[0].removed).toBe(true);
  });

  it("one evening visit straddling UTC midnight bills one monitoring visit", () => {
    // 19:30 and 20:30 EDT serialize as 23:30Z and 00:30Z next day — one
    // visit in Québec local time, and it must bill as one.
    const lines = deriveLines(
      context({
        readings: [
          reading({ taken_at: "2026-08-20T23:30:00Z" }),
          reading({ id: "read-2", taken_at: "2026-08-21T00:30:00Z" }),
        ],
      }),
    );
    expect(byRule(lines, "drying.monitoring")[0].quantity).toBe(1);
  });

  it("applyMinimumCharges is idempotent and respects an operator-edited minimum", () => {
    const ctx = context({ readings: [reading({})] });
    const minimums = { Restoration: 100000 };
    const once = applyMinimumCharges(deriveLines(ctx), minimums);
    const twice = applyMinimumCharges(once, minimums);
    expect(twice.filter((l) => l.key === "minimum:Restoration")).toHaveLength(1);

    const edited = once.map((l) =>
      l.key === "minimum:Restoration" ? { ...l, origin: "manual" as const, replaceRateCents: 12345 } : l,
    );
    const merged = applyMinimumCharges(mergeLines(edited, deriveLines(ctx)), minimums);
    const minLines = merged.filter((l) => l.key === "minimum:Restoration");
    expect(minLines).toHaveLength(1);
    expect(minLines[0].replaceRateCents).toBe(12345);
  });

  it("an E&R line credits each side's dollars to its own trade's minimum", () => {
    // A cabinet replacement pairs DEM-CAB-LF (category Kitchen) with
    // CAB-INST-BASE (category Cabinetry). The Kitchen minimum must be
    // measured against the removal money only.
    const ctx = context({
      rooms: [
        room({ objects: [object({ kind: "base_cabinet", disposition: "replace", width: 1 })] }),
      ],
    });
    const lines = deriveLines(ctx);
    const er = byRule(lines, "object.disposition")[0];
    const removalBase = Math.round(
      (Math.round(er.quantity * 100) * (er.removeRateCents ?? 0)) / 100,
    );
    const withMin = applyMinimumCharges(lines, { Kitchen: removalBase + 5000 });
    const top = withMin.find((l) => l.key === "minimum:Kitchen");
    expect(top?.replaceRateCents).toBe(5000);
  });
});
