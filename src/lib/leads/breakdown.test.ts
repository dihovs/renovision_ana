import { describe, expect, it } from "vitest";
import { labelForSource, leadBreakdown } from "./breakdown";

describe("labelForSource", () => {
  it("names the search engine rather than the slug", () => {
    expect(labelForSource("chat:organic_google")).toBe("Google search");
    expect(labelForSource("contact:organic_bing")).toBe("Bing search");
    // An engine added to attribution.ts but not to the label map still reads,
    // rather than disappearing from the only chart that would show it.
    expect(labelForSource("chat:organic_kagi")).toBe("kagi search");
  });

  it("names social networks and referring sites", () => {
    expect(labelForSource("chat:social_facebook")).toBe("Facebook");
    expect(labelForSource("web:ref_lespac_ca")).toBe("lespac.ca");
  });

  it("shows a campaign slug exactly as it was written", () => {
    expect(labelForSource("chat:google_cpc_july")).toBe("google_cpc_july");
  });

  it("treats a phone call as a known arrival, not a gap", () => {
    // It has no referrer and never will. Counting it as unattributed would
    // suggest something is missing that could be fixed.
    expect(labelForSource("voice")).toBe("Phone call");
    expect(labelForSource("whatsapp")).toBe("WhatsApp");
  });

  it("returns null for a channel the browser could not describe", () => {
    expect(labelForSource("chat")).toBeNull();
    expect(labelForSource("website")).toBeNull();
    expect(labelForSource("")).toBeNull();
    expect(labelForSource(null)).toBeNull();
  });
});

describe("leadBreakdown", () => {
  const leads = [
    { source: "chat:organic_google", heard_about: null },
    { source: "chat:organic_google", heard_about: null },
    { source: "voice", heard_about: "plumber" },
    { source: "voice", heard_about: "referral" },
    { source: "website", heard_about: "plumber" },
    { source: null, heard_about: null },
  ];

  it("counts arrivals biggest first", () => {
    const { online, total } = leadBreakdown(leads);
    expect(total).toBe(6);
    expect(online).toEqual([
      { label: "Google search", count: 2 },
      { label: "Phone call", count: 2 },
    ]);
  });

  it("counts the ones the browser could not describe separately", () => {
    // "website" and null both mean no referrer survived — and both are exactly
    // the leads the heard-about question is asked of.
    expect(leadBreakdown(leads).unattributed).toBe(2);
  });

  it("keeps what customers said in its own column", () => {
    expect(leadBreakdown(leads).offline).toEqual([
      { label: "A plumber or another trade", count: 2 },
      { label: "A friend or family member", count: 1 },
    ]);
  });

  // The mistake the two columns exist to prevent. Online and offline describe
  // overlapping leads from different evidence, so their counts must never be
  // presentable as one total.
  it("never merges the two columns", () => {
    const { online, offline, total } = leadBreakdown(leads);
    const onlineTotal = online.reduce((n, r) => n + r.count, 0);
    const offlineTotal = offline.reduce((n, r) => n + r.count, 0);
    expect(onlineTotal).toBe(4);
    expect(offlineTotal).toBe(3);
    expect(onlineTotal + offlineTotal).not.toBe(total);
  });

  it("ignores a heard_about value that is not on the allowlist", () => {
    expect(leadBreakdown([{ source: "chat", heard_about: "Google" }]).offline).toEqual([]);
  });

  it("handles an empty pipeline", () => {
    expect(leadBreakdown([])).toEqual({ online: [], offline: [], unattributed: 0, total: 0 });
  });

  it("orders equal counts alphabetically so refreshing does not reshuffle", () => {
    const rows = leadBreakdown([
      { source: "chat:social_facebook", heard_about: null },
      { source: "chat:organic_google", heard_about: null },
    ]).online;
    expect(rows.map((r) => r.label)).toEqual(["Facebook", "Google search"]);
  });
});
