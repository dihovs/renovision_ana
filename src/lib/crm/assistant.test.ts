import { describe, expect, it } from "vitest";
import { sanitiseImages, trimForSpeech } from "./assistant";

/**
 * The one pure decision in the brief path. (ANA-08)
 *
 * buildContext itself is a database walk and is exercised by using the admin;
 * what must hold regardless is that a trim keeps the head — identity and money
 * — and says that it trimmed, so "that is everything" is never said about a
 * record that had more.
 */
describe("trimForSpeech", () => {
  it("leaves a short record alone", () => {
    expect(trimForSpeech("RECORD TYPE: job\nJob #12")).toBe("RECORD TYPE: job\nJob #12");
  });

  it("keeps the head and admits the cut", () => {
    const context = `RECORD TYPE: job\n${"x".repeat(9000)}`;
    const trimmed = trimForSpeech(context);
    expect(trimmed.startsWith("RECORD TYPE: job")).toBe(true);
    expect(trimmed.length).toBeLessThan(context.length);
    expect(trimmed).toContain("Trimmed for the phone");
  });

  it("never trims into silence at a custom cap", () => {
    const trimmed = trimForSpeech("abcdefghij", 4);
    expect(trimmed.startsWith("abcd")).toBe(true);
    expect(trimmed).toContain("Trimmed");
  });
});

/**
 * Which attachments are allowed to reach Claude. (ANA-22)
 *
 * The property that matters is all-or-nothing: dropping one bad photo and
 * sending the rest would have the owner believing Ana looked at something she
 * never saw, and on a question about damage "she didn't mention the ceiling"
 * would read as an opinion rather than a photo that went missing.
 */
describe("sanitiseImages", () => {
  const good = { media_type: "image/jpeg", data: "AAAABBBBCCCC==" };

  it("passes a normal set through", () => {
    expect(sanitiseImages([good, good])).toEqual([good, good]);
  });

  it("treats nothing as nothing", () => {
    expect(sanitiseImages(undefined)).toBeUndefined();
    expect(sanitiseImages([])).toBeUndefined();
  });

  it("refuses the whole set when one photo is a type vision cannot read", () => {
    expect(sanitiseImages([good, { media_type: "image/heic", data: "AAAA" }])).toBeUndefined();
    expect(sanitiseImages([{ media_type: "application/pdf", data: "AAAA" }])).toBeUndefined();
  });

  it("refuses a data: prefix left on the front — the common mistake", () => {
    expect(
      sanitiseImages([{ media_type: "image/jpeg", data: "data:image/jpeg;base64,AAAA" }]),
    ).toBeUndefined();
  });

  it("refuses anything that is not base64", () => {
    expect(sanitiseImages([{ media_type: "image/png", data: "not base64!" }])).toBeUndefined();
    expect(sanitiseImages([{ media_type: "image/png", data: "" }])).toBeUndefined();
  });

  it("refuses a fourth photo rather than quietly keeping three", () => {
    expect(sanitiseImages([good, good, good])).toHaveLength(3);
    expect(sanitiseImages([good, good, good, good])).toBeUndefined();
  });

  it("refuses one that is too large to be a downscaled photo", () => {
    const huge = { media_type: "image/jpeg", data: "A".repeat(4_000_001) };
    expect(sanitiseImages([huge])).toBeUndefined();
  });
});
