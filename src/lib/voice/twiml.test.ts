import crypto from "crypto";
import { describe, expect, it } from "vitest";
import { publicUrl, publicUrlVariants, verifyTwilioSignature } from "./twiml";

/**
 * The bug these pin, in one sentence: Twilio signs the URL written in its
 * console, not the URL the request lands on, so the two spellings of our own
 * domain disagreeing turned every authentic request into a 403 — and on the
 * softphone that reached the owner as "we are sorry, an application error has
 * occurred". 2026-08-09.
 */

const AUTH_TOKEN = "test-auth-token-not-a-real-one";

/** Exactly what Twilio does: HMAC-SHA1 over url + sorted key/value pairs. */
function sign(url: string, params: Record<string, string>, token = AUTH_TOKEN): string {
  const payload = Object.keys(params)
    .sort()
    .reduce((acc, key) => acc + key + params[key], url);
  return crypto.createHmac("sha1", token).update(Buffer.from(payload, "utf-8")).digest("base64");
}

function requestArrivingAt(host: string, path = "/api/voice/softphone"): Request {
  // Vercel's proxy shape: the internal URL on the request, the real host in
  // the forwarded headers.
  return new Request(`https://internal.vercel.invalid${path}`, {
    method: "POST",
    headers: { "x-forwarded-host": host, "x-forwarded-proto": "https" },
  });
}

const PARAMS = { To: "+15145550188", From: "client:renovision-admin", CallSid: "CA123" };

describe("publicUrl — the forwarded host is the one Twilio dialled", () => {
  it("rebuilds the public URL from the proxy headers, not the internal one", () => {
    expect(publicUrl(requestArrivingAt("www.renovisionana.ca"))).toBe(
      "https://www.renovisionana.ca/api/voice/softphone",
    );
  });
});

describe("publicUrlVariants", () => {
  it("leads with the spelling the request actually arrived at", () => {
    // First place matters: the common case must cost one HMAC, not four.
    expect(publicUrlVariants(requestArrivingAt("www.renovisionana.ca"))[0]).toBe(
      "https://www.renovisionana.ca/api/voice/softphone",
    );
    expect(publicUrlVariants(requestArrivingAt("renovisionana.ca"))[0]).toBe(
      "https://renovisionana.ca/api/voice/softphone",
    );
  });

  it("covers both spellings of the host and both schemes", () => {
    expect(new Set(publicUrlVariants(requestArrivingAt("www.renovisionana.ca")))).toEqual(
      new Set([
        "https://www.renovisionana.ca/api/voice/softphone",
        "https://renovisionana.ca/api/voice/softphone",
        "http://www.renovisionana.ca/api/voice/softphone",
        "http://renovisionana.ca/api/voice/softphone",
      ]),
    );
  });

  it("never invents a host that is not a spelling of this one", () => {
    // The safety property: every candidate is our own domain, no exceptions.
    const variants = publicUrlVariants(requestArrivingAt("www.renovisionana.ca"));
    expect(variants).toHaveLength(4);
    expect(new Set(variants).size).toBe(4);
    for (const v of variants) {
      expect(new URL(v).hostname.replace(/^www\./, "")).toBe("renovisionana.ca");
      expect(new URL(v).pathname).toBe("/api/voice/softphone");
    }
  });
});

describe("verifyTwilioSignature", () => {
  it("accepts a signature computed over the URL the request arrived at", () => {
    const request = requestArrivingAt("www.renovisionana.ca");
    expect(
      verifyTwilioSignature({
        signature: sign("https://www.renovisionana.ca/api/voice/softphone", PARAMS),
        url: publicUrlVariants(request),
        params: PARAMS,
        authToken: AUTH_TOKEN,
      }),
    ).toBe(true);
  });

  it("accepts one signed against the apex while arriving at www — THE REGRESSION", () => {
    // The console said renovisionana.ca; Vercel served www.renovisionana.ca.
    // Before publicUrlVariants this returned false and the caller heard an
    // apology from Twilio.
    const request = requestArrivingAt("www.renovisionana.ca");
    expect(
      verifyTwilioSignature({
        signature: sign("https://renovisionana.ca/api/voice/softphone", PARAMS),
        url: publicUrlVariants(request),
        params: PARAMS,
        authToken: AUTH_TOKEN,
      }),
    ).toBe(true);
  });

  it("accepts one signed against www while arriving at the apex", () => {
    const request = requestArrivingAt("renovisionana.ca");
    expect(
      verifyTwilioSignature({
        signature: sign("https://www.renovisionana.ca/api/voice/softphone", PARAMS),
        url: publicUrlVariants(request),
        params: PARAMS,
        authToken: AUTH_TOKEN,
      }),
    ).toBe(true);
  });

  it("still refuses a signature made with the wrong auth token", () => {
    // The property that actually matters: widening the URL set must not widen
    // who can forge a request. The key is the gate, and it has not moved.
    const request = requestArrivingAt("www.renovisionana.ca");
    expect(
      verifyTwilioSignature({
        signature: sign(
          "https://www.renovisionana.ca/api/voice/softphone",
          PARAMS,
          "an-attackers-guess",
        ),
        url: publicUrlVariants(request),
        params: PARAMS,
        authToken: AUTH_TOKEN,
      }),
    ).toBe(false);
  });

  it("still refuses a signature for a different host entirely", () => {
    const request = requestArrivingAt("www.renovisionana.ca");
    expect(
      verifyTwilioSignature({
        signature: sign("https://evil.example.com/api/voice/softphone", PARAMS),
        url: publicUrlVariants(request),
        params: PARAMS,
        authToken: AUTH_TOKEN,
      }),
    ).toBe(false);
  });

  it("still refuses when a parameter has been tampered with", () => {
    const request = requestArrivingAt("www.renovisionana.ca");
    const signature = sign("https://www.renovisionana.ca/api/voice/softphone", PARAMS);
    expect(
      verifyTwilioSignature({
        signature,
        url: publicUrlVariants(request),
        params: { ...PARAMS, To: "+15145559999" },
        authToken: AUTH_TOKEN,
      }),
    ).toBe(false);
  });

  it("refuses with no signature, and refuses with no auth token", () => {
    const url = publicUrlVariants(requestArrivingAt("www.renovisionana.ca"));
    expect(
      verifyTwilioSignature({ signature: null, url, params: PARAMS, authToken: AUTH_TOKEN }),
    ).toBe(false);
    expect(
      verifyTwilioSignature({
        signature: sign("https://www.renovisionana.ca/api/voice/softphone", PARAMS),
        url,
        params: PARAMS,
        authToken: undefined,
      }),
    ).toBe(false);
  });

  it("survives a pasted token that picked up whitespace — THE OTHER PASTE FAILURE", () => {
    // The env var is a human paste into a dashboard field. A trailing newline
    // or space is invisible in every UI that displays it, and it changes every
    // HMAC computed from it. Trimming is safe because a real token can never
    // contain whitespace: this can only stop a right key from failing, never
    // make a wrong key pass — which the wrong-token test above still proves.
    const request = requestArrivingAt("www.renovisionana.ca");
    for (const damaged of [`${AUTH_TOKEN}\n`, ` ${AUTH_TOKEN} `, `${AUTH_TOKEN}\r\n`]) {
      expect(
        verifyTwilioSignature({
          signature: sign("https://www.renovisionana.ca/api/voice/softphone", PARAMS),
          url: publicUrlVariants(request),
          params: PARAMS,
          authToken: damaged,
        }),
      ).toBe(true);
    }
  });

  it("still takes a single URL string, for callers that pass one", () => {
    expect(
      verifyTwilioSignature({
        signature: sign("https://www.renovisionana.ca/api/voice/softphone", PARAMS),
        url: "https://www.renovisionana.ca/api/voice/softphone",
        params: PARAMS,
        authToken: AUTH_TOKEN,
      }),
    ).toBe(true);
  });
});
