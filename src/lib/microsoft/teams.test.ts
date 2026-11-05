import { describe, expect, it } from "vitest";
import {
  mapChatMessage,
  teamsHtmlToText,
  type GraphChat,
  type GraphChatMessage,
} from "./teams";

/**
 * The pure half of the Teams sync. (ANA-05)
 *
 * The skip rules are the boundary here: a systemEventMessage is where call
 * events live, and "skipped" is the difference between ingesting messages and
 * ingesting the call surface the owner ruled out. So every skip is a named
 * test, not a side effect.
 */

const OWNER = "00000000-aaaa-bbbb-cccc-000000000001";
const MIKE = "00000000-aaaa-bbbb-cccc-000000000002";

const chat: GraphChat = {
  id: "chat-1",
  chatType: "oneOnOne",
  topic: null,
  members: [
    { userId: OWNER, displayName: "Artush" },
    { userId: MIKE, displayName: "Mike Plumber" },
  ],
};

function message(overrides: Partial<GraphChatMessage> = {}): GraphChatMessage {
  return {
    id: "msg-1",
    messageType: "message",
    createdDateTime: "2026-08-31T14:00:00Z",
    from: { user: { id: MIKE, displayName: "Mike Plumber" } },
    body: { contentType: "html", content: "<p>The tiles arrived</p>" },
    ...overrides,
  };
}

describe("teamsHtmlToText", () => {
  it("keeps the words and drops the markup", () => {
    expect(teamsHtmlToText("<p>The tiles <b>arrived</b> today</p>")).toBe(
      "The tiles arrived today",
    );
  });

  it("keeps the name inside a mention — the sentence reads wrong without it", () => {
    expect(teamsHtmlToText('did <at id="0">Mike</at> confirm the grout')).toBe(
      "did Mike confirm the grout",
    );
  });

  it("drops attachment placeholders entirely — the file is named separately", () => {
    expect(teamsHtmlToText('before <attachment id="abc"></attachment> after')).toBe("before after");
    expect(teamsHtmlToText('x <attachment id="a"/> y')).toBe("x y");
  });

  it("turns line-shaped tags into lines and collapses the padding", () => {
    expect(teamsHtmlToText("<p>one</p><p>two<br>three</p>")).toBe("one\ntwo\nthree");
  });

  it("decodes the entities people actually type", () => {
    expect(teamsHtmlToText("R&amp;D &nbsp;quote &lt;tomorrow&gt; &#39;ok&#39;")).toBe(
      "R&D quote <tomorrow> 'ok'",
    );
  });

  it("treats nothing as nothing", () => {
    expect(teamsHtmlToText(null)).toBe("");
    expect(teamsHtmlToText("")).toBe("");
    expect(teamsHtmlToText("<p> </p>")).toBe("");
  });
});

describe("mapChatMessage", () => {
  it("maps an inbound message with the sender named", () => {
    const row = mapChatMessage(message(), chat, OWNER);
    expect(row).not.toBeNull();
    expect(row!.direction).toBe("inbound");
    expect(row!.sender_name).toBe("Mike Plumber");
    expect(row!.counterpart_name).toBe("Mike Plumber");
    expect(row!.body).toBe("The tiles arrived");
  });

  it("marks the owner's own messages outbound", () => {
    const row = mapChatMessage(
      message({ from: { user: { id: OWNER, displayName: "Artush" } } }),
      chat,
      OWNER,
    );
    expect(row!.direction).toBe("outbound");
    // The counterpart is still Mike — "Us → Artush" would label nothing.
    expect(row!.counterpart_name).toBe("Mike Plumber");
  });

  it("skips system events — call started, member added — which is where calls would leak in", () => {
    expect(
      mapChatMessage(message({ messageType: "systemEventMessage", body: undefined }), chat, OWNER),
    ).toBeNull();
    expect(mapChatMessage(message({ messageType: "unknownFutureType" }), chat, OWNER)).toBeNull();
  });

  it("skips deleted messages — a withdrawn message stays withdrawn", () => {
    expect(
      mapChatMessage(message({ deletedDateTime: "2026-08-31T15:00:00Z" }), chat, OWNER),
    ).toBeNull();
  });

  it("skips bots — Ana quotes people", () => {
    expect(
      mapChatMessage(
        message({ from: { application: { id: "bot", displayName: "Polly" } } }),
        chat,
        OWNER,
      ),
    ).toBeNull();
  });

  it("skips meeting chats — the chat surface of a call", () => {
    expect(mapChatMessage(message(), { ...chat, chatType: "meeting" }, OWNER)).toBeNull();
  });

  it("skips reactions and cards — no words, no file, nothing to quote", () => {
    expect(mapChatMessage(message({ body: { contentType: "html", content: "" } }), chat, OWNER)).toBeNull();
  });

  it("names an attachment without pretending to know what is in it", () => {
    const row = mapChatMessage(
      message({
        body: { contentType: "html", content: "" },
        attachments: [{ name: "plan-fleury.pdf", contentType: "reference" }],
      }),
      chat,
      OWNER,
    );
    expect(row!.attachment).toBe("file: plan-fleury.pdf");
    expect(row!.body).toBe("");
  });

  it("labels a group chat by its topic", () => {
    const group: GraphChat = {
      id: "chat-2",
      chatType: "group",
      topic: "Fleury bathroom",
      members: chat.members,
    };
    const row = mapChatMessage(message(), group, OWNER);
    expect(row!.chat_type).toBe("group");
    expect(row!.counterpart_name).toBe("Fleury bathroom");
    // The sender still matters in a group — that is who said it.
    expect(row!.sender_name).toBe("Mike Plumber");
  });
});
