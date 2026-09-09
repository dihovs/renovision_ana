import crypto from "crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SOFTPHONE_IDENTITY } from "@/lib/voice/accessToken";

/**
 * The line of last resort, for the night ElevenLabs' own billing failed and
 * there was no code path to intercept it — see the comment on the route
 * itself. This is a plain Twilio TwiML webhook, exactly like softphone's,
 * signed the same way; the tests exercise that shape directly rather than
 * mocking verifyTwilioSignature away, since a signature bug here is the
 * entire difference between "the fallback works" and a second dead line.
 */

const AUTH_TOKEN = "test-fallback-secret";
const URL = "https://www.renovisionana.ca/api/voice/fallback";

function sign(url: string, params: Record<string, string>): string {
  const payload = Object.keys(params)
    .sort()
    .reduce((acc, key) => acc + key + params[key], url);
  return crypto.createHmac("sha1", AUTH_TOKEN).update(Buffer.from(payload, "utf-8")).digest("base64");
}

async function post(params: Record<string, string>, options: { signed?: boolean } = {}) {
  const body = new URLSearchParams(params).toString();
  const headers: Record<string, string> = {
    "content-type": "application/x-www-form-urlencoded",
    "x-forwarded-host": "www.renovisionana.ca",
    "x-forwarded-proto": "https",
  };
  if (options.signed !== false) {
    headers["x-twilio-signature"] = sign(URL, params);
  }
  const { POST } = await import("./route");
  const response = await POST(
    new Request("https://internal.vercel.invalid/api/voice/fallback", {
      method: "POST",
      headers,
      body,
    }),
  );
  return { status: response.status, text: await response.text() };
}

const CALL_PARAMS = { CallSid: "CA999", From: "+15145550188", To: "+15799995979" };

describe("the emergency fallback — rings the admin app and the owner's mobile", () => {
  beforeEach(() => {
    process.env.TWILIO_AUTH_TOKEN = AUTH_TOKEN;
    process.env.OWNER_MOBILE = "+15145550100";
    process.env.SMS_FROM_NUMBER = "+15799995979";
  });

  afterEach(() => {
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.OWNER_MOBILE;
    delete process.env.SMS_FROM_NUMBER;
  });

  it("refuses a request that is not genuinely from Twilio", async () => {
    const { status } = await post(CALL_PARAMS, { signed: false });
    expect(status).toBe(403);
  });

  it("dials both the admin softphone identity and the owner's mobile", async () => {
    const { status, text } = await post(CALL_PARAMS);
    expect(status).toBe(200);
    expect(text).toContain(`<Client>${SOFTPHONE_IDENTITY}</Client>`);
    expect(text).toContain("<Number>+15145550100</Number>");
  });

  it("shows the business number as caller ID, never the owner's own", () => {
    return post(CALL_PARAMS).then(({ text }) => {
      expect(text).toContain('callerId="+15799995979"');
      expect(text).not.toContain("+15145550100\" ");
    });
  });

  it("still rings the softphone alone when no owner mobile is configured", async () => {
    delete process.env.OWNER_MOBILE;
    const { status, text } = await post(CALL_PARAMS);
    expect(status).toBe(200);
    expect(text).toContain(`<Client>${SOFTPHONE_IDENTITY}</Client>`);
    expect(text).not.toContain("<Number>");
  });

  it("falls back to SITE_PHONE_TEL for caller ID when SMS_FROM_NUMBER is unset", async () => {
    delete process.env.SMS_FROM_NUMBER;
    const { text } = await post(CALL_PARAMS);
    // SITE_PHONE_TEL is a hardcoded constant, not an env var, so it is always
    // present — this only confirms the fallback reads it rather than failing
    // closed the moment one env var is missing.
    expect(text).toMatch(/callerId="\+1\d{10}"/);
  });
});
