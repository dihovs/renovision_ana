import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NO_OWNER_SESSION, isOwnerNumber, ownerModeConfigured, ownerSession } from "./owner";

/**
 * Owner mode is one factor now: the caller's number. The PIN this suite used to
 * spend most of its length on was removed on the owner's explicit instruction —
 * see the module comment in owner.ts. What is left to prove is narrower but not
 * smaller in importance, because with the second factor gone the allowlist is
 * the ONLY thing between a caller and the CRM:
 *
 *   - it fails closed when unconfigured;
 *   - it matches his line however the number is written;
 *   - it does not match anyone else's, including near-misses;
 *   - nothing the caller SAYS can change the answer.
 */

const OWNER = "+15799903077";

beforeEach(() => {
  process.env.OWNER_PHONE_NUMBERS = OWNER;
});

afterEach(() => {
  delete process.env.OWNER_PHONE_NUMBERS;
});

describe("ownerModeConfigured", () => {
  it("is on with an allowlist and off without one", () => {
    expect(ownerModeConfigured()).toBe(true);
    delete process.env.OWNER_PHONE_NUMBERS;
    expect(ownerModeConfigured()).toBe(false);
  });

  it("no longer depends on a PIN being set", () => {
    // The variable is still in Vercel and is now unused. Owner mode must not
    // switch itself off when it is finally deleted.
    delete process.env.OWNER_VOICE_PIN;
    expect(ownerModeConfigured()).toBe(true);
  });

  it("treats an empty or whitespace allowlist as unconfigured", () => {
    process.env.OWNER_PHONE_NUMBERS = "";
    expect(ownerModeConfigured()).toBe(false);
    process.env.OWNER_PHONE_NUMBERS = "  ,  , ";
    expect(ownerModeConfigured()).toBe(false);
  });
});

describe("isOwnerNumber — however the number happens to be written", () => {
  it("matches the same line across formats on both sides", () => {
    for (const written of ["+15799903077", "15799903077", "5799903077", "(579) 990-3077", "579-990-3077"]) {
      process.env.OWNER_PHONE_NUMBERS = written;
      expect(isOwnerNumber("+15799903077")).toBe(true);
      expect(isOwnerNumber("5799903077")).toBe(true);
    }
  });

  it("matches any entry in a list", () => {
    process.env.OWNER_PHONE_NUMBERS = "+15145550188, +15799903077";
    expect(isOwnerNumber(OWNER)).toBe(true);
    expect(isOwnerNumber("+15145550188")).toBe(true);
  });

  it("refuses anyone else, including a one-digit miss", () => {
    expect(isOwnerNumber("+15145550188")).toBe(false);
    expect(isOwnerNumber("+15799903078")).toBe(false);
  });

  it("refuses a missing or too-short number rather than matching loosely", () => {
    // A partial number must never match on a suffix — "3077" is not his line.
    for (const value of [null, undefined, "", "3077", "990-3077", "not a number"]) {
      expect(isOwnerNumber(value)).toBe(false);
    }
  });

  it("is closed when no allowlist is set, even for a plausible number", () => {
    delete process.env.OWNER_PHONE_NUMBERS;
    expect(isOwnerNumber(OWNER)).toBe(false);
  });
});

describe("ownerSession", () => {
  it("opens on the owner's number, with nothing spoken", () => {
    // The whole point of the change: he rings and he is in.
    expect(ownerSession(OWNER)).toEqual({ authenticated: true });
  });

  it("stays shut for everyone else", () => {
    expect(ownerSession("+15145550188")).toEqual({ authenticated: false });
    expect(ownerSession(null)).toEqual({ authenticated: false });
  });

  it("stays shut when owner mode is not configured", () => {
    delete process.env.OWNER_PHONE_NUMBERS;
    expect(ownerSession(OWNER)).toEqual({ authenticated: false });
  });

  it("cannot be talked into opening — it never reads the transcript", () => {
    // The old version scanned every utterance for a code, which meant what the
    // caller SAID fed the decision about what the caller could SEE. It no
    // longer takes the transcript at all, so there is no utterance to craft.
    expect(ownerSession.length).toBe(1);
    expect(ownerSession("+15145550188")).toEqual({ authenticated: false });
  });
});

describe("NO_OWNER_SESSION", () => {
  it("is what every customer and outbound call gets", () => {
    expect(NO_OWNER_SESSION).toEqual({ authenticated: false });
  });
});
