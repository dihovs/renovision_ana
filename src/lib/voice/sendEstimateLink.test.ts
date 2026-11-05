import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The dedup guard on send_estimate_link. (ANA-23)
 *
 * The one property that matters: a caller who keeps pushing for a price
 * after already getting the link hears the answer repeated in WORDS, never
 * three copies of the same text. Everything else here (locale, failure
 * surfacing) is the ordinary sendSms contract this just has to pass through
 * honestly.
 */

vi.mock("@/lib/sms/send", () => ({ sendSms: vi.fn() }));

const { sendSms } = await import("@/lib/sms/send");
const { sendEstimateLink } = await import("./agent");

describe("sendEstimateLink", () => {
  beforeEach(() => {
    vi.mocked(sendSms).mockReset();
    vi.mocked(sendSms).mockResolvedValue({ sent: true, sid: "SM123" });
  });

  it("sends once for a fresh call", async () => {
    const result = await sendEstimateLink("+15145551234", "en", "CA-fresh-1");
    expect(result).toEqual({ sent: true });
    expect(sendSms).toHaveBeenCalledTimes(1);
  });

  it("refuses a second send on the same call — the caller gets it once", async () => {
    const callSid = "CA-repeat-1";
    await sendEstimateLink("+15145551234", "en", callSid);
    const second = await sendEstimateLink("+15145551234", "en", callSid);
    expect(second).toEqual({ sent: false, reason: "already_sent" });
    // Only the first attempt should have touched Twilio.
    expect(sendSms).toHaveBeenCalledTimes(1);
  });

  it("allows the same number a fresh send on a DIFFERENT call", async () => {
    await sendEstimateLink("+15145551234", "en", "CA-a");
    const onAnotherCall = await sendEstimateLink("+15145551234", "en", "CA-b");
    expect(onAnotherCall).toEqual({ sent: true });
  });

  it("refuses with no number to text — nothing to send it to", async () => {
    const result = await sendEstimateLink(null, "en", "CA-no-number");
    expect(result).toEqual({ sent: false, reason: "no_number" });
    expect(sendSms).not.toHaveBeenCalled();
  });

  it("surfaces a Twilio failure rather than claiming success", async () => {
    vi.mocked(sendSms).mockResolvedValueOnce({ sent: false, reason: "failed", detail: "boom" });
    const result = await sendEstimateLink("+15145551234", "en", "CA-fails");
    expect(result).toEqual({ sent: false, reason: "failed" });
  });

  it("writes the French link with no dedup collision against the English one", async () => {
    // Different locale, different call — must not be blocked by the earlier
    // English send in this same test file's shared dedup set.
    const result = await sendEstimateLink("+15145551234", "fr", "CA-french-1");
    expect(result).toEqual({ sent: true });
    const [call] = vi.mocked(sendSms).mock.calls.slice(-1);
    expect(call[0].body).toContain("estimation");
    expect(call[0].locale).toBe("fr");
  });

  it("marks the message as automated, so it gets CASL's unsubscribe footer", async () => {
    await sendEstimateLink("+15145551234", "en", "CA-casl-1");
    const [call] = vi.mocked(sendSms).mock.calls.slice(-1);
    expect(call[0].automated).toBe(true);
  });

  it("never lets Ana compose the body — it is always the same fixed sentence plus the link", async () => {
    await sendEstimateLink("+15145551234", "en", "CA-fixed-body");
    const [call] = vi.mocked(sendSms).mock.calls.slice(-1);
    expect(call[0].body).toMatch(/^Here's the link for your online estimate: https:\/\//);
  });
});
