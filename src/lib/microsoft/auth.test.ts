import { describe, expect, it } from "vitest";
import { beginAuthorization, pkceChallenge, type MicrosoftConfig } from "./auth";
import { GRAPH_SCOPES } from "./scopes";

/**
 * The authorize URL, checked before anyone consents to it. (ANA-04)
 *
 * The URL is the request: whatever is in its scope parameter is what the owner
 * is shown and what Microsoft grants. So the test pins the URL itself, not an
 * intermediate — if a call scope ever reached the consent screen, this is the
 * last place it passes through.
 */

const config: MicrosoftConfig = {
  tenantId: "11111111-2222-3333-4444-555555555555",
  clientId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  clientSecret: "not-checked-here",
  redirectUri: "https://www.renovisionana.ca/api/v1/microsoft/callback",
};

describe("beginAuthorization", () => {
  it("sends the owner to his own tenant, not to /common", () => {
    // /common would accept any Microsoft account in the world; the tenant URL
    // accepts his. A consented personal account would look connected and read
    // an empty mailbox.
    const { url } = beginAuthorization(config);
    expect(url.startsWith(`https://login.microsoftonline.com/${config.tenantId}/`)).toBe(true);
  });

  it("asks for exactly GRAPH_SCOPES — the consent screen shows nothing else", () => {
    const { url } = beginAuthorization(config);
    const scope = new URL(url).searchParams.get("scope") ?? "";
    expect(scope.split(" ").sort()).toEqual([...GRAPH_SCOPES].sort());
  });

  it("carries no call scope, as the owner instructed", () => {
    const { url } = beginAuthorization(config);
    expect(new URL(url).searchParams.get("scope") ?? "").not.toMatch(/call|meeting/i);
  });

  it("uses PKCE S256, never the plain method", () => {
    const { url, verifier } = beginAuthorization(config);
    const params = new URL(url).searchParams;
    expect(params.get("code_challenge_method")).toBe("S256");
    expect(params.get("code_challenge")).toBe(pkceChallenge(verifier));
    // The verifier itself must never appear in the URL — it is the secret the
    // challenge commits to.
    expect(url).not.toContain(verifier);
  });

  it("issues fresh state and verifier every time", () => {
    const first = beginAuthorization(config);
    const second = beginAuthorization(config);
    expect(first.state).not.toBe(second.state);
    expect(first.verifier).not.toBe(second.verifier);
  });

  it("forces the account chooser", () => {
    // Without prompt=select_account Microsoft silently reuses whichever account
    // the browser is signed into — on a shared machine, the wrong mailbox.
    const { url } = beginAuthorization(config);
    expect(new URL(url).searchParams.get("prompt")).toBe("select_account");
  });
});
