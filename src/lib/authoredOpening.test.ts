import { describe, expect, it } from "vitest";
import { readAuthoredOpening } from "./authoredOpening";

describe("an opening placed on the phone, as the save reads it", () => {
  it("keeps which way a door opens, and its height and sill", () => {
    expect(
      readAuthoredOpening({
        edge: 2,
        offset: 0.05,
        width: 0.89,
        kind: "doorSingle",
        height: 2.032,
        sill: 0,
        hingeAtStart: false,
        swingInward: false,
      }),
    ).toEqual({
      edge: 2,
      offset: 0.05,
      width: 0.89,
      kind: "doorSingle",
      height: 2.032,
      sill: 0,
      hingeAtStart: false,
      swingInward: false,
    });
  });

  it("saves an opening nobody has asked about without inventing answers", () => {
    expect(readAuthoredOpening({ edge: 0, offset: 0.9, width: 0.97, kind: "windowStandard" })).toEqual({
      edge: 0,
      offset: 0.9,
      width: 0.97,
      kind: "windowStandard",
    });
  });

  it("drops a record that cannot be placed", () => {
    expect(readAuthoredOpening({ edge: -1, offset: 0, width: 1, kind: "doorSingle" })).toBeNull();
    expect(readAuthoredOpening({ edge: 1.5, offset: 0, width: 1, kind: "doorSingle" })).toBeNull();
    expect(readAuthoredOpening({ edge: 0, offset: "x", width: 1, kind: "doorSingle" })).toBeNull();
    expect(readAuthoredOpening({ edge: 0, offset: 0, width: 1 })).toBeNull();
    expect(readAuthoredOpening(null)).toBeNull();
  });

  it("leaves out a malformed answer on its own and still saves the opening", () => {
    expect(
      readAuthoredOpening({
        edge: 0,
        offset: 0,
        width: 1,
        kind: "doorSingle",
        height: -2,
        sill: "low",
        swingInward: "out",
      }),
    ).toEqual({ edge: 0, offset: 0, width: 1, kind: "doorSingle" });
  });
});
