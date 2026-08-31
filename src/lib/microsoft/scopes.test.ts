import { describe, expect, it } from "vitest";
import { FORBIDDEN_SCOPES, GRAPH_SCOPES, missingScopes, scopeParameter } from "./scopes";

/**
 * The owner's instruction, kept true by a test. (ANA-04)
 *
 * "Teams messages, Outlook, OneDrive — not the voice calls." The enforcement is
 * that the scope is never requested, so what these tests guard is the request
 * list itself: the same shape as writeBoundary.test.ts, where the imports are
 * the boundary and the test reads them.
 */

describe("the scope boundary", () => {
  it("asks for nothing on the forbidden list", () => {
    const requested = new Set<string>(GRAPH_SCOPES.map((s) => s.toLowerCase()));
    for (const forbidden of FORBIDDEN_SCOPES) {
      expect(requested.has(forbidden.toLowerCase()), `${forbidden} must never be requested`).toBe(
        false,
      );
    }
  });

  it("asks for no call, meeting or transcript scope in any spelling", () => {
    // Belt and braces beyond the named list: nothing call-shaped gets in under
    // a name the list did not anticipate.
    for (const scope of GRAPH_SCOPES) {
      expect(scope).not.toMatch(/call|meeting|transcript|recording|presence/i);
    }
  });

  it("asks for nothing tenant-wide except the file search Graph requires", () => {
    // Files.Read.All is "all files the OWNER can reach", a delegated scope with
    // .All in the name — Graph offers no narrower one that can search his
    // drive. Everything else must be singular.
    for (const scope of GRAPH_SCOPES) {
      if (scope === "Files.Read.All") continue;
      expect(scope).not.toMatch(/\.All$/i);
    }
  });

  it("asks for nothing that can write or send", () => {
    for (const scope of GRAPH_SCOPES) {
      expect(scope).not.toMatch(/write|send|manage/i);
    }
  });

  it("keeps offline_access, without which the connection dies within the hour", () => {
    expect(GRAPH_SCOPES).toContain("offline_access");
  });

  it("keeps the four the built orders need", () => {
    expect(GRAPH_SCOPES).toContain("Chat.Read");
    expect(GRAPH_SCOPES).toContain("Mail.Read");
    expect(GRAPH_SCOPES).toContain("Files.Read.All");
    expect(GRAPH_SCOPES).toContain("User.Read");
  });

  it("does not ask for channel messages — 1:1 chats only, confirmed 30 Aug 2026", () => {
    expect([...GRAPH_SCOPES]).not.toContain("ChannelMessage.Read.All");
  });
});

describe("scopeParameter", () => {
  it("is the space-separated form the authorize endpoint takes", () => {
    const param = scopeParameter();
    expect(param.split(" ").sort()).toEqual([...GRAPH_SCOPES].sort());
    expect(param).not.toContain(",");
  });
});

describe("missingScopes", () => {
  it("reports nothing missing when everything granted", () => {
    expect(missingScopes([...GRAPH_SCOPES])).toEqual([]);
  });

  it("names what an administrator quietly withheld", () => {
    const granted = GRAPH_SCOPES.filter((s) => s !== "Mail.Read");
    expect(missingScopes(granted)).toEqual(["Mail.Read"]);
  });

  it("compares case-insensitively, because Microsoft echoes scopes in its own casing", () => {
    expect(missingScopes(GRAPH_SCOPES.map((s) => s.toUpperCase()))).toEqual([]);
  });

  it("does not demand offline_access back, which Microsoft honours without echoing", () => {
    const granted = GRAPH_SCOPES.filter((s) => s !== "offline_access");
    expect(missingScopes(granted)).toEqual([]);
  });
});
