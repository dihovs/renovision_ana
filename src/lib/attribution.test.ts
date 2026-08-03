import { describe, expect, it } from "vitest";
import {
  MAX_SOURCE_TOKEN_LENGTH,
  parseAttribution,
  sanitizeLeadSource,
} from "./attribution";

const OWN_HOST = "renovisionana.ca";

describe("parseAttribution", () => {
  it("returns null for a direct visit (no query, no referrer)", () => {
    expect(parseAttribution("", "")).toBeNull();
    expect(parseAttribution("?", "", OWN_HOST)).toBeNull();
  });

  it("builds the token from utm parts in a fixed order", () => {
    expect(parseAttribution("?utm_source=facebook&utm_medium=cpc&utm_campaign=july", "")).toBe(
      "facebook_cpc_july",
    );
    // Order comes from the parameter's meaning, not its position in the URL.
    expect(parseAttribution("?utm_campaign=july&utm_source=facebook", "")).toBe("facebook_july");
  });

  it("accepts the search string with or without the leading question mark", () => {
    expect(parseAttribution("utm_source=google", "")).toBe("google");
    expect(parseAttribution("?utm_source=google", "")).toBe("google");
  });

  it("prefers utm over the referrer when both are present", () => {
    expect(parseAttribution("?utm_source=newsletter", "https://www.google.com/search")).toBe(
      "newsletter",
    );
  });

  it("lowercases and strips utm values to the token alphabet", () => {
    expect(parseAttribution("?utm_source=FaceBook%20Ads!", "")).toBe("facebookads");
    // Accents, symbols and spaces all vanish rather than mutate.
    expect(parseAttribution("?utm_campaign=%C3%A9t%C3%A9+2026", "")).toBe("t2026");
  });

  it("survives hostile query strings by reducing them to boring slugs", () => {
    expect(parseAttribution("?utm_source=<script>alert(1)</script>", "")).toBe("scriptalert1script");
    expect(parseAttribution("?utm_source='%3B%20DROP%20TABLE%20leads--", "")).toBe(
      "droptableleads--",
    );
    // Pure emoji/unicode payloads contribute nothing and fall through to null.
    expect(parseAttribution("?utm_source=%F0%9F%94%A5%F0%9F%94%A5", "")).toBeNull();
  });

  it("caps each utm part and the whole token", () => {
    const long = "a".repeat(500);
    const token = parseAttribution(
      `?utm_source=${long}&utm_medium=${long}&utm_campaign=${long}&utm_content=${long}`,
      "",
    )!;
    expect(token.length).toBeLessThanOrEqual(MAX_SOURCE_TOKEN_LENGTH);
    // 4 parts x 24 chars max each, joined — proves the per-part cap ran too.
    expect(token).toBe(("a".repeat(24) + "_").repeat(2) + "a".repeat(14));
  });

  it("drops empty utm values instead of storing separators", () => {
    expect(parseAttribution("?utm_source=&utm_campaign=july", "")).toBe("july");
  });

  it("classifies search-engine referrers as organic", () => {
    expect(parseAttribution("", "https://www.google.com/")).toBe("organic_google");
    expect(parseAttribution("", "https://google.ca/url?q=x")).toBe("organic_google");
    expect(parseAttribution("", "https://www.bing.com/search")).toBe("organic_bing");
    // Whole-label match only: a lookalike host is a referral, not organic.
    expect(parseAttribution("", "https://notgoogle.com/")).toBe("ref_notgoogle_com");
  });

  it("classifies social referrers, collapsing shim domains", () => {
    expect(parseAttribution("", "https://l.facebook.com/l.php?u=x")).toBe("social_facebook");
    expect(parseAttribution("", "https://fb.com/")).toBe("social_facebook");
    expect(parseAttribution("", "https://t.co/abc")).toBe("social_twitter");
    expect(parseAttribution("", "https://www.instagram.com/")).toBe("social_instagram");
  });

  it("keeps other referrer hostnames as a flattened ref_ token", () => {
    expect(parseAttribution("", "https://www.lespac.com/annonce/123")).toBe("ref_lespac_com");
  });

  it("ignores internal navigation and www variants of our own host", () => {
    expect(parseAttribution("", `https://${OWN_HOST}/services`, OWN_HOST)).toBeNull();
    expect(parseAttribution("", `https://www.${OWN_HOST}/`, OWN_HOST)).toBeNull();
    expect(parseAttribution("", `https://${OWN_HOST}/`, `www.${OWN_HOST}`)).toBeNull();
  });

  it("returns null for unparseable or degenerate referrers", () => {
    expect(parseAttribution("", "not a url")).toBeNull();
    // Parses as a URL but carries no hostname — schemes browsers never put in
    // a Referer header, so only a hand-built request looks like this.
    expect(parseAttribution("", "javascript:alert(1)")).toBeNull();
    expect(parseAttribution("", "data:text/html,x")).toBeNull();
    expect(parseAttribution("", "https://")).toBeNull();
  });

  it("caps a ridiculous referrer hostname", () => {
    const host = "a".repeat(300) + ".com";
    const token = parseAttribution("", `https://${host}/`)!;
    expect(token.startsWith("ref_a")).toBe(true);
    expect(token.length).toBeLessThanOrEqual(MAX_SOURCE_TOKEN_LENGTH);
  });
});

describe("sanitizeLeadSource", () => {
  it("accepts channel:token in the documented grammar", () => {
    expect(sanitizeLeadSource("chat:facebook_cpc_july")).toBe("chat:facebook_cpc_july");
    expect(sanitizeLeadSource("contact:organic_google")).toBe("contact:organic_google");
    expect(sanitizeLeadSource("web:ref_lespac_com")).toBe("web:ref_lespac_com");
  });

  it("accepts a bare channel", () => {
    expect(sanitizeLeadSource("chat")).toBe("chat");
    expect(sanitizeLeadSource("contact")).toBe("contact");
  });

  it("rejects channels the browser is not allowed to claim", () => {
    // A bot must not be able to masquerade as the phone agent or as the
    // pre-attribution default.
    expect(sanitizeLeadSource("phone")).toBeUndefined();
    expect(sanitizeLeadSource("phone:spoofed")).toBeUndefined();
    expect(sanitizeLeadSource("whatsapp")).toBeUndefined();
    expect(sanitizeLeadSource("website")).toBeUndefined();
    expect(sanitizeLeadSource("anything-else:x")).toBeUndefined();
  });

  it("rejects tokens outside the alphabet, whatever the intent", () => {
    expect(sanitizeLeadSource("chat:has space")).toBeUndefined();
    expect(sanitizeLeadSource("chat:<img src=x>")).toBeUndefined();
    expect(sanitizeLeadSource("chat:UPPER")).toBeUndefined();
    expect(sanitizeLeadSource("chat:t%C3%A9l")).toBeUndefined();
    expect(sanitizeLeadSource("chat:")).toBeUndefined();
  });

  it("rejects extra colons and oversized tokens", () => {
    expect(sanitizeLeadSource("chat:a:b")).toBeUndefined();
    expect(sanitizeLeadSource(`chat:${"a".repeat(MAX_SOURCE_TOKEN_LENGTH)}`)).toBe(
      `chat:${"a".repeat(MAX_SOURCE_TOKEN_LENGTH)}`,
    );
    expect(sanitizeLeadSource(`chat:${"a".repeat(MAX_SOURCE_TOKEN_LENGTH + 1)}`)).toBeUndefined();
  });

  it("rejects non-strings without throwing", () => {
    expect(sanitizeLeadSource(undefined)).toBeUndefined();
    expect(sanitizeLeadSource(null)).toBeUndefined();
    expect(sanitizeLeadSource(42)).toBeUndefined();
    expect(sanitizeLeadSource({ toString: () => "chat" })).toBeUndefined();
    expect(sanitizeLeadSource(["chat"])).toBeUndefined();
  });
});
