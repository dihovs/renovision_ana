import crypto from "crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mintVoiceToken, SOFTPHONE_IDENTITY } from "./accessToken";

/**
 * The token goes to a browser, so what it is NOT allowed to do matters as much
 * as what it is. The grant assertions below are the security boundary of the
 * whole softphone feature.
 */

const SECRET = "api-key-secret";

function decode(segment: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(segment, "base64url").toString("utf-8"));
}

describe("minting a voice access token", () => {
  beforeEach(() => {
    process.env.TWILIO_ACCOUNT_SID = "AC_account";
    process.env.TWILIO_API_KEY_SID = "SK_key";
    process.env.TWILIO_API_KEY_SECRET = SECRET;
    process.env.TWILIO_TWIML_APP_SID = "AP_app";
  });

  afterEach(() => {
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_API_KEY_SID;
    delete process.env.TWILIO_API_KEY_SECRET;
    delete process.env.TWILIO_TWIML_APP_SID;
  });

  it("names every missing variable rather than failing vaguely", () => {
    delete process.env.TWILIO_API_KEY_SID;
    delete process.env.TWILIO_TWIML_APP_SID;

    const result = mintVoiceToken();

    expect(result).toEqual({
      ok: false,
      missing: ["TWILIO_API_KEY_SID", "TWILIO_TWIML_APP_SID"],
    });
  });

  it("carries the Twilio first-party content type, without which Twilio rejects it", () => {
    const result = mintVoiceToken(1_700_000_000);
    if (!result.ok) throw new Error("expected a token");

    expect(decode(result.token.split(".")[0])).toEqual({
      typ: "JWT",
      alg: "HS256",
      cty: "twilio-fpa;v=1",
    });
  });

  it("grants outgoing calls through the configured app, and refuses incoming", () => {
    const result = mintVoiceToken(1_700_000_000);
    if (!result.ok) throw new Error("expected a token");

    const payload = decode(result.token.split(".")[1]);
    expect(payload.grants).toEqual({
      identity: SOFTPHONE_IDENTITY,
      voice: {
        outgoing: { application_sid: "AP_app" },
        // A leaked token must not be able to register a client that ANSWERS
        // the business's calls — that would silently intercept customers.
        incoming: { allow: false },
      },
    });
  });

  it("is issued by the API key and scoped to the account", () => {
    const result = mintVoiceToken(1_700_000_000);
    if (!result.ok) throw new Error("expected a token");

    const payload = decode(result.token.split(".")[1]);
    expect(payload.iss).toBe("SK_key");
    expect(payload.sub).toBe("AC_account");
  });

  it("expires an hour out, and is not valid before it was issued", () => {
    const issued = 1_700_000_000;
    const result = mintVoiceToken(issued);
    if (!result.ok) throw new Error("expected a token");

    const payload = decode(result.token.split(".")[1]);
    expect(payload.nbf).toBe(issued);
    expect(payload.exp).toBe(issued + 3600);
  });

  it("is signed with the API key secret, so Twilio will accept it", () => {
    const result = mintVoiceToken(1_700_000_000);
    if (!result.ok) throw new Error("expected a token");

    const [header, payload, signature] = result.token.split(".");
    const expected = crypto
      .createHmac("sha256", SECRET)
      .update(`${header}.${payload}`)
      .digest("base64url");

    expect(signature).toBe(expected);
  });

  it("does not put the API key secret anywhere in the token", () => {
    const result = mintVoiceToken(1_700_000_000);
    if (!result.ok) throw new Error("expected a token");

    expect(result.token).not.toContain(SECRET);
    expect(Buffer.from(result.token).toString()).not.toContain(SECRET);
  });
});
