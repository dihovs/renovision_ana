import { describe, expect, it } from "vitest";
import {
  estimateStatusLine,
  referenceGiveUpLine,
  referenceNotFoundLine,
  type LeadStatusRow,
} from "./estimateStatus";

const row = (over: Partial<LeadStatusRow> = {}): LeadStatusRow => ({
  status: "new",
  opened_at: null,
  created_at: "2026-08-20T14:00:00.000Z",
  ...over,
});

const ALL_STATUSES = ["new", "contacted", "quoted", "won", "lost", "something_new"];

describe("estimateStatusLine", () => {
  it("confirms receipt and promises a call, opened or not", () => {
    for (const opened of [null, "2026-08-21T09:00:00.000Z"]) {
      const en = estimateStatusLine(row({ opened_at: opened }), "en");
      expect(en).toMatch(/came through/i);
      expect(en).toMatch(/calling you shortly/i);
      const fr = estimateStatusLine(row({ opened_at: opened }), "fr");
      expect(fr).toMatch(/bien reçue/i);
    }
  });

  it("says the team has seen it only when it has actually been opened", () => {
    expect(estimateStatusLine(row({ opened_at: "2026-08-21T09:00:00.000Z" }), "en")).toMatch(
      /team has seen it/i,
    );
    expect(estimateStatusLine(row({ opened_at: null }), "en")).not.toMatch(/team has seen it/i);
  });

  // The whole point of the module. Every one of these facts is true, internal,
  // and would cost the job if a customer heard it.
  it("never says anything a customer should not hear", () => {
    for (const status of ALL_STATUSES) {
      for (const locale of ["en", "fr"] as const) {
        for (const opened of [null, "2026-08-21T09:00:00.000Z"]) {
          const line = estimateStatusLine(row({ status, opened_at: opened }), locale);
          expect(line).not.toMatch(/\blost\b|\bperdu\b/i);
          expect(line).not.toMatch(/\bqueue\b|\bfile d'attente\b/i);
          expect(line).not.toMatch(/not (?:yet )?(?:been )?(?:opened|read|looked)/i);
          expect(line).not.toMatch(/pas encore (?:ouvert|lu|regard)/i);
          // No money, ever — the same rule that stops Ana quoting on the phone
          // does not lapse because the number is already in the database.
          expect(line).not.toMatch(/\$|\bCAD\b|\bdollar/i);
          expect(line.trim().length).toBeGreaterThan(20);
        }
      }
    }
  });

  it("offers to reopen a lost lead instead of closing the door", () => {
    expect(estimateStatusLine(row({ status: "lost" }), "en")).toMatch(/pick it back up/i);
    expect(estimateStatusLine(row({ status: "lost" }), "fr")).toMatch(/reprenne/i);
  });

  it("dates the request so both sides know it is the same one", () => {
    expect(estimateStatusLine(row(), "en")).toMatch(/August 20/);
    expect(estimateStatusLine(row(), "fr")).toMatch(/20 août/);
  });

  it("survives a date it cannot parse rather than saying 'Invalid Date'", () => {
    const line = estimateStatusLine(row({ created_at: "not a date" }), "en");
    expect(line).not.toMatch(/invalid/i);
    expect(line).toMatch(/came through/i);
  });

  it("treats an unknown status as an ordinary new request", () => {
    expect(estimateStatusLine(row({ status: "something_new" }), "en")).toMatch(/came through/i);
  });
});

describe("the misses", () => {
  it("blames the line, not the caller, and gives up after the second try", () => {
    expect(referenceNotFoundLine("en")).toMatch(/misheard/i);
    expect(referenceNotFoundLine("fr")).toMatch(/mal entendu/i);
    expect(referenceGiveUpLine("en")).toMatch(/call you back/i);
    expect(referenceGiveUpLine("fr")).toMatch(/rappelle/i);
  });
});
