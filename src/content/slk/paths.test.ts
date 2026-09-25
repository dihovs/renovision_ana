import { describe, expect, it } from "vitest";
import { copy } from "./copy";
import { slkCounterpart } from "./paths";

describe("slkCounterpart", () => {
  it("maps home and shared pages", () => {
    expect(slkCounterpart("fr", "/slk")).toBe("/slk/en");
    expect(slkCounterpart("en", "/slk/en")).toBe("/slk");
    expect(slkCounterpart("fr", "/slk/contact")).toBe("/slk/en/contact");
    expect(slkCounterpart("en", "/slk/en/services")).toBe("/slk/services");
  });

  it("translates the about page segment", () => {
    expect(slkCounterpart("fr", "/slk/a-propos")).toBe("/slk/en/about");
    expect(slkCounterpart("en", "/slk/en/about")).toBe("/slk/a-propos");
  });

  it("translates every service slug and round-trips", () => {
    expect(copy.fr.services).toHaveLength(copy.en.services.length);
    copy.fr.services.forEach((s, i) => {
      const en = slkCounterpart("fr", `/slk/services/${s.slug}`);
      expect(en).toBe(`/slk/en/services/${copy.en.services[i].slug}`);
      expect(copy.en.services[i].category).toBe(s.category);
      expect(slkCounterpart("en", en)).toBe(`/slk/services/${s.slug}`);
    });
  });

  it("falls back to the services index for an unknown slug", () => {
    expect(slkCounterpart("fr", "/slk/services/nope")).toBe("/slk/en/services");
  });
});
