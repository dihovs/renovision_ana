import { describe, expect, it } from "vitest";
import {
  HEARD_ABOUT_OPTIONS,
  HEARD_ABOUT_VALUES,
  isHeardAboutValue,
  shouldAskHeardAbout,
} from "./heardAbout";

describe("shouldAskHeardAbout", () => {
  // The whole point of the field. Asking somebody who arrived on
  // organic_google where they heard of us spends a form field to earn an
  // answer we already hold, more accurately, without asking.
  it("stays quiet when the browser already knows", () => {
    expect(shouldAskHeardAbout("chat:organic_google")).toBe(false);
    expect(shouldAskHeardAbout("chat:social_facebook")).toBe(false);
    expect(shouldAskHeardAbout("contact:ref_lespac_ca")).toBe(false);
    expect(shouldAskHeardAbout("chat:google_cpc_july")).toBe(false);
  });

  it("asks when the visit carried no attribution at all", () => {
    // A bare channel means they typed the address, or arrived somewhere the
    // referrer did not survive — the case the question exists for.
    expect(shouldAskHeardAbout("chat")).toBe(true);
    expect(shouldAskHeardAbout("website")).toBe(true);
    expect(shouldAskHeardAbout(null)).toBe(true);
    expect(shouldAskHeardAbout(undefined)).toBe(true);
    expect(shouldAskHeardAbout("")).toBe(true);
  });
});

describe("isHeardAboutValue", () => {
  it("accepts the seven, and nothing that merely looks like them", () => {
    for (const value of HEARD_ABOUT_VALUES) expect(isHeardAboutValue(value)).toBe(true);
    for (const bad of ["Google", "google ", "plombier", "", null, undefined, 7, {}]) {
      expect(isHeardAboutValue(bad)).toBe(false);
    }
  });
});

describe("the vocabulary", () => {
  // Three copies of this list already exist — the contact form, the admin
  // labels, and the route's allowlist. This module is the fourth only if it
  // agrees with them; if it drifts, "plumber" and "plombier" become two rows
  // in the report the field exists to produce.
  it("labels every value in both languages", () => {
    for (const value of HEARD_ABOUT_VALUES) {
      expect(HEARD_ABOUT_OPTIONS[value].en.length).toBeGreaterThan(3);
      expect(HEARD_ABOUT_OPTIONS[value].fr.length).toBeGreaterThan(3);
      expect(HEARD_ABOUT_OPTIONS[value].en).not.toBe(HEARD_ABOUT_OPTIONS[value].fr);
    }
  });

  it("matches the slugs the API has accepted since 0016", () => {
    expect(HEARD_ABOUT_VALUES).toEqual([
      "google",
      "referral",
      "plumber",
      "insurance_broker",
      "social",
      "neighbourhood",
      "other",
    ]);
  });
});
