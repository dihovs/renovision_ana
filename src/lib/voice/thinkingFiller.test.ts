import { describe, expect, it, vi } from "vitest";

/**
 * Filling the silence while a tool runs, and not running two rounds together.
 *
 * Both behaviours live in `ownerReplyToStream`'s loop and both are about what
 * the caller HEARS, which is a different code path from the transcript the
 * function returns. That distinction is the whole reason the concatenation bug
 * shipped: `spoken.join(" ")` produced a perfectly spaced transcript while the
 * delta stream ran the rounds together.
 *
 * From the real call on 2026-08-02, Ana said "Let me check." in round one and
 * "Looks like seven leads came in today" in round two, and the caller heard
 * "Let me check.Looks like seven leads" — no gap. The first test here is that
 * exact conversation.
 *
 * The Anthropic SDK is stubbed to return a scripted two-round tool exchange;
 * everything else is the real function.
 */

type Round = { text: string; toolUse: boolean };

/**
 * A stand-in for the SDK that replays scripted rounds.
 *
 * Constructed with `new Anthropic()`, so this has to be a real constructor —
 * an arrow function fails with "is not a constructor" rather than anything
 * that points at the mock.
 */
function mockAnthropic(rounds: Round[]) {
  let round = 0;
  return class {
    messages = {
      stream(_params: unknown) {
        const current = rounds[Math.min(round, rounds.length - 1)];
        round++;
        let onText: ((d: string) => void) | undefined;
        const handle = {
          on(event: string, cb: (d: string) => void) {
            if (event === "text") onText = cb;
            return handle;
          },
          async finalMessage() {
            // Deltas arrive before finalMessage resolves, as the SDK does it.
            if (current.text) onText?.(current.text);
            return {
              stop_reason: current.toolUse ? "tool_use" : "end_turn",
              content: [
                ...(current.text ? [{ type: "text", text: current.text }] : []),
                ...(current.toolUse
                  ? [{ type: "tool_use", id: `tu_${round}`, name: "business_snapshot", input: {} }]
                  : []),
              ],
            };
          },
        };
        return handle;
      },
    };
  };
}

async function runOwnerTurn(rounds: Round[]) {
  vi.resetModules();
  const Anthropic = mockAnthropic(rounds);
  vi.doMock("@anthropic-ai/sdk", () => ({ default: Anthropic }));

  const { ownerReplyToStream } = await import("./agent");

  const heard: string[] = [];
  const reply = await ownerReplyToStream(
    [{ role: "caller", text: "did we have any leads today?", at: new Date().toISOString() }],
    {
      locale: "en",
      tools: [{ name: "business_snapshot", description: "d", input_schema: { type: "object" } }],
      runTool: async () => "7 leads",
    },
    (d) => heard.push(d),
  );

  return { spokenStream: heard.join(""), transcript: reply.text };
}

describe("what the owner actually hears across tool rounds", () => {
  it("does not run two rounds together, the bug from the 2026-08-02 call", async () => {
    const { spokenStream } = await runOwnerTurn([
      { text: "Let me check.", toolUse: true },
      { text: "Looks like seven leads came in today", toolUse: false },
    ]);

    expect(spokenStream).not.toContain("check.Looks");
    expect(spokenStream).toContain("Let me check. Looks like seven leads came in today");
  });

  it("keeps the transcript and the spoken stream saying the same thing", async () => {
    const { spokenStream, transcript } = await runOwnerTurn([
      { text: "Let me check.", toolUse: true },
      { text: "Seven leads.", toolUse: false },
    ]);

    // Whitespace may differ; the words and their order may not. A transcript
    // that reads correctly while the caller hears something else is how this
    // went unnoticed in the first place.
    const words = (s: string) => s.split(/\s+/).filter(Boolean).join(" ");
    expect(words(spokenStream)).toBe(words(transcript));
  });

  it("fills the silence when the model reaches for a tool without saying anything", async () => {
    const { spokenStream } = await runOwnerTurn([
      { text: "", toolUse: true },
      { text: "Seven leads came in today.", toolUse: false },
    ]);

    // A tool round is a second or two of dead air; something has to be said.
    expect(spokenStream.length).toBeGreaterThan("Seven leads came in today.".length);
    expect(spokenStream.trim()).not.toMatch(/^Seven leads/);
    expect(spokenStream).toContain("Seven leads came in today.");
  });

  it("stays quiet when the model already announced it, rather than doubling up", async () => {
    const { spokenStream } = await runOwnerTurn([
      { text: "Let me check.", toolUse: true },
      { text: "Seven leads.", toolUse: false },
    ]);

    // Its own lead-in beats anything canned, so no filler is added on top.
    expect(spokenStream).toBe("Let me check. Seven leads.");
  });

  it("says nothing extra on a turn that needs no tool at all", async () => {
    const { spokenStream } = await runOwnerTurn([{ text: "Nothing new today.", toolUse: false }]);
    expect(spokenStream).toBe("Nothing new today.");
  });
});

describe("the filler phrases themselves", () => {
  it("offers more than one, in both languages", async () => {
    vi.resetModules();
    const { thinkingFiller } = await import("./agent");

    // Repetition is the tell that someone is talking to a recording, so the
    // set must be varied rather than a single stock phrase.
    const seen = new Set(Array.from({ length: 60 }, () => thinkingFiller("fr")));
    expect(seen.size).toBeGreaterThan(1);
    expect(new Set(Array.from({ length: 60 }, () => thinkingFiller("en"))).size).toBeGreaterThan(1);
  });

  it("keeps them short, and free of promises about what will be found", async () => {
    vi.resetModules();
    const { thinkingFiller } = await import("./agent");

    for (const locale of ["fr", "en"] as const) {
      for (let i = 0; i < 40; i++) {
        const filler = thinkingFiller(locale);
        // Spoken aloud mid-pause: a long one defeats the purpose.
        expect(filler.split(/\s+/).length).toBeLessThanOrEqual(5);
        // "Let me find that for you" commits to an answer that may not exist.
        expect(filler.toLowerCase()).not.toMatch(/found|trouvé|voici|here (is|are)/);
      }
    }
  });
});
