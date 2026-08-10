import { describe, expect, it } from "vitest";
import { groupIntoConversations, type ConversationRow } from "./inbox";

/**
 * The fold that turns a message log into an inbox. The rules under test are
 * the ones the owner will read off the screen: which thread sits on top, when
 * the "needs a reply" badge shows, and that a stranger's number is a
 * conversation even though no client row exists for it.
 */

function row(overrides: Partial<ConversationRow>): ConversationRow {
  return {
    phone: "+15145550188",
    body: "hello",
    direction: "inbound",
    status: "received",
    created_at: "2026-08-09T12:00:00Z",
    client_id: null,
    ...overrides,
  };
}

describe("groupIntoConversations", () => {
  it("makes one conversation per number, counting every message", () => {
    const out = groupIntoConversations([
      row({ phone: "+15145550188", created_at: "2026-08-09T12:00:00Z" }),
      row({ phone: "+14505550123", created_at: "2026-08-09T11:00:00Z" }),
      row({ phone: "+15145550188", created_at: "2026-08-09T10:00:00Z" }),
    ]);
    expect(out).toHaveLength(2);
    expect(out[0].phone).toBe("+15145550188");
    expect(out[0].messageCount).toBe(2);
    expect(out[1].messageCount).toBe(1);
  });

  it("orders by latest activity, because rows arrive newest-first", () => {
    // The thread with the newest message leads, regardless of which number
    // texted first ever.
    const out = groupIntoConversations([
      row({ phone: "+14505550123", created_at: "2026-08-09T12:00:00Z" }),
      row({ phone: "+15145550188", created_at: "2026-08-09T11:59:00Z" }),
      row({ phone: "+14505550123", created_at: "2026-08-01T09:00:00Z" }),
    ]);
    expect(out.map((c) => c.phone)).toEqual(["+14505550123", "+15145550188"]);
  });

  it("takes every 'last' field from the newest message only", () => {
    const out = groupIntoConversations([
      row({ body: "see you at 3", direction: "outbound", status: "queued" }),
      row({ body: "older message", created_at: "2026-08-09T09:00:00Z" }),
    ]);
    expect(out[0].lastBody).toBe("see you at 3");
    expect(out[0].lastDirection).toBe("outbound");
  });

  it("flags a thread whose last word is theirs as awaiting a reply", () => {
    const theirs = groupIntoConversations([row({ direction: "inbound" })]);
    expect(theirs[0].awaitingReply).toBe(true);

    const ours = groupIntoConversations([row({ direction: "outbound", status: "queued" })]);
    expect(ours[0].awaitingReply).toBe(false);
  });

  it("flags a thread whose last send failed", () => {
    const out = groupIntoConversations([row({ direction: "outbound", status: "failed" })]);
    expect(out[0].lastFailed).toBe(true);
    // A failed send further back is not the headline — the newest message is.
    const recovered = groupIntoConversations([
      row({ direction: "outbound", status: "queued", created_at: "2026-08-09T12:00:00Z" }),
      row({ direction: "outbound", status: "failed", created_at: "2026-08-09T11:00:00Z" }),
    ]);
    expect(recovered[0].lastFailed).toBe(false);
  });

  it("keeps a stranger's number as a conversation with no client attached", () => {
    const out = groupIntoConversations([row({ client_id: null })]);
    expect(out[0].clientId).toBeNull();
  });

  it("names the thread from any attributed message, not just the newest", () => {
    // The first texts arrived before the client existed; attribution appeared
    // later in the thread's history. The conversation still gets the client.
    const out = groupIntoConversations([
      row({ client_id: null, created_at: "2026-08-09T12:00:00Z" }),
      row({ client_id: "client-1", created_at: "2026-08-09T11:00:00Z" }),
    ]);
    expect(out[0].clientId).toBe("client-1");
  });

  it("is empty on empty input", () => {
    expect(groupIntoConversations([])).toEqual([]);
  });
});
