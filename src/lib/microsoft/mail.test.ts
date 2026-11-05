import { describe, expect, it } from "vitest";
import { identityFor, mailHtmlToText, mapMailMessage, type GraphMailMessage } from "./mail";

/**
 * The pure half of the mail sync. (ANA-06)
 *
 * The direction rule is the one that must never be wrong: an outbound reply
 * filed as inbound turns the owner's own words into "what the customer said",
 * which is exactly the corruption record_brief would then repeat with a
 * straight face.
 */

const OWNER = "artush@renovisionana.ca";

function mail(overrides: Partial<GraphMailMessage> = {}): GraphMailMessage {
  return {
    id: "mail-1",
    conversationId: "thread-1",
    subject: "Re: Fleury bathroom",
    isDraft: false,
    from: { emailAddress: { address: "marie.tremblay@acme.ca", name: "Marie Tremblay" } },
    toRecipients: [{ emailAddress: { address: OWNER, name: "Artush" } }],
    receivedDateTime: "2026-08-31T13:00:00Z",
    body: { contentType: "html", content: "<p>We agreed on the grey tile</p>" },
    ...overrides,
  };
}

describe("mailHtmlToText", () => {
  it("drops style blocks wholesale — a newsletter's CSS is not information", () => {
    expect(mailHtmlToText("<style>.x{color:red}</style><p>the words</p>")).toBe("the words");
  });

  it("drops head, script and comments", () => {
    expect(
      mailHtmlToText("<head><title>x</title></head><script>a()</script><!-- hidden --><p>kept</p>"),
    ).toBe("kept");
  });

  it("then behaves like the Teams strip", () => {
    expect(mailHtmlToText("<p>one</p><p>R&amp;D<br>two</p>")).toBe("one\nR&D\ntwo");
  });
});

describe("mapMailMessage", () => {
  it("maps inbound mail with the sender named", () => {
    const row = mapMailMessage(mail(), OWNER);
    expect(row).not.toBeNull();
    expect(row!.direction).toBe("inbound");
    expect(row!.from_address).toBe("marie.tremblay@acme.ca");
    expect(row!.counterpart_name).toBe("Marie Tremblay");
  });

  it("marks the owner's own mail outbound, comparing addresses case-insensitively", () => {
    const row = mapMailMessage(
      mail({
        from: { emailAddress: { address: "Artush@RenovisionAna.ca", name: "Artush" } },
        toRecipients: [{ emailAddress: { address: "marie.tremblay@acme.ca", name: "Marie Tremblay" } }],
      }),
      OWNER,
    );
    expect(row!.direction).toBe("outbound");
    // The counterpart is Marie — the transcript line is "Us → Marie Tremblay".
    expect(row!.counterpart_name).toBe("Marie Tremblay");
  });

  it("rides the subject on the body's first line, so one search finds both", () => {
    const row = mapMailMessage(mail(), OWNER);
    expect(row!.body).toBe("Re: Fleury bathroom\n\nWe agreed on the grey tile");
    expect(row!.subject).toBe("Re: Fleury bathroom");
  });

  it("skips drafts — unsent words are nobody's statement yet", () => {
    expect(mapMailMessage(mail({ isDraft: true }), OWNER)).toBeNull();
  });

  it("names attachments without opening them", () => {
    const row = mapMailMessage(
      mail({ attachments: [{ name: "plan.pdf" }, { name: "photos.zip" }] }),
      OWNER,
    );
    expect(row!.attachment).toBe("file: plan.pdf, photos.zip");
  });

  it("keeps a subject-only mail — the subject often IS the message", () => {
    const row = mapMailMessage(
      mail({ body: { contentType: "html", content: "" }, subject: "Tomorrow 9am confirmed" }),
      OWNER,
    );
    expect(row).not.toBeNull();
    expect(row!.body).toBe("Tomorrow 9am confirmed");
  });

  it("skips a mail with no subject, no words and no file", () => {
    expect(
      mapMailMessage(
        mail({ subject: null, body: { contentType: "html", content: "<p> </p>" } }),
        OWNER,
      ),
    ).toBeNull();
  });

  it("caps a marketing blast rather than mirroring it", () => {
    const row = mapMailMessage(
      mail({ body: { contentType: "text", content: "x".repeat(50_000) } }),
      OWNER,
    );
    expect(row!.body.length).toBeLessThanOrEqual(20_000);
  });
});

describe("identityFor", () => {
  it("attaches inbound mail to its sender", () => {
    const row = mapMailMessage(mail(), OWNER)!;
    expect(identityFor(row)).toEqual({ address: "marie.tremblay@acme.ca", name: "Marie Tremblay" });
  });

  it("attaches outbound mail to its first recipient — the owner is not a contact", () => {
    const row = mapMailMessage(
      mail({
        from: { emailAddress: { address: OWNER, name: "Artush" } },
        toRecipients: [{ emailAddress: { address: "marie.tremblay@acme.ca", name: "Marie Tremblay" } }],
      }),
      OWNER,
    )!;
    expect(identityFor(row)?.address).toBe("marie.tremblay@acme.ca");
  });

  it("has nobody to attach when a no-reply hides its address", () => {
    const row = mapMailMessage(mail({ from: { emailAddress: { address: null, name: "System" } } }), OWNER)!;
    expect(identityFor(row)).toBeNull();
  });
});
