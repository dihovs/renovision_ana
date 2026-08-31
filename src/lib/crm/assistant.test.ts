import { describe, expect, it } from "vitest";
import { trimForSpeech } from "./assistant";

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
