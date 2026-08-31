import { createHash, randomBytes } from "node:crypto";
import { SITE_URL } from "@/lib/constants";
import { GRAPH_SCOPES, scopeParameter } from "./scopes";
import { invalidateConnection, readConnection, saveConnection, type TokenFailure } from "./tokens";

/**
 * The OAuth round trip with Microsoft. (ANA-04)
 *
 * Authorization-code flow with PKCE, delegated, against one tenant. Nothing
 * here is unusual; what is worth reading is which of the easy shortcuts were
 * not taken and why, because each one would have been invisible later.
 *
 * PKCE ON A CONFIDENTIAL CLIENT. Strictly optional when there is a client
 * secret, and included anyway. The authorization code travels through a
 * browser redirect — a referrer log, an extension, shoulder-surfing on a shared
 * screen — and without PKCE a stolen code is redeemable by anyone who also has
 * the secret. It costs two hashes.
 *
 * THE REDIRECT URI IS AN ENVIRONMENT VARIABLE, not a value derived from the
 * request. Deriving it from the incoming Host header means an attacker who can
 * set that header chooses where the code is sent. Microsoft compares it against
 * the registration, so a mismatch is a loud failure at consent time rather than
 * a quiet one later.
 */

export type MicrosoftConfig = {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

export type ConfigProblem = { ok: false; missing: string[] };

/**
 * The three values from the Entra app registration, or which ones are missing.
 *
 * Named rather than counted: "Microsoft is not configured" sends someone
 * hunting through a dashboard, and "MICROSOFT_CLIENT_SECRET is not set" does not.
 */
export function microsoftConfig(): { ok: true; config: MicrosoftConfig } | ConfigProblem {
  const tenantId = process.env.MICROSOFT_TENANT_ID?.trim();
  const clientId = process.env.MICROSOFT_CLIENT_ID?.trim();
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET?.trim();
  const redirectUri =
    process.env.MICROSOFT_REDIRECT_URI?.trim() || `${SITE_URL}/api/v1/microsoft/callback`;

  const missing: string[] = [];
  if (!tenantId) missing.push("MICROSOFT_TENANT_ID");
  if (!clientId) missing.push("MICROSOFT_CLIENT_ID");
  if (!clientSecret) missing.push("MICROSOFT_CLIENT_SECRET");
  if (missing.length) return { ok: false, missing };

  return {
    ok: true,
    config: { tenantId: tenantId!, clientId: clientId!, clientSecret: clientSecret!, redirectUri },
  };
}

const authority = (tenantId: string) => `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0`;

/** base64url of 32 random bytes — the PKCE verifier and the CSRF state alike. */
function randomToken(): string {
  return randomBytes(32).toString("base64url");
}

export function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

/**
 * Where to send the owner, plus the two secrets the callback will need back.
 *
 * `state` is compared on return so a consent screen someone else started cannot
 * complete into this session; `verifier` proves the code is being redeemed by
 * whoever asked for it. Both belong in an httpOnly cookie, never in the URL.
 */
export function beginAuthorization(config: MicrosoftConfig): {
  url: string;
  state: string;
  verifier: string;
} {
  const state = randomToken();
  const verifier = randomToken();

  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: "code",
    redirect_uri: config.redirectUri,
    response_mode: "query",
    scope: scopeParameter(),
    state,
    code_challenge: pkceChallenge(verifier),
    code_challenge_method: "S256",
    // Force the account chooser. Without it Microsoft silently reuses whichever
    // account the browser is already signed into, which on a shared machine
    // connects the wrong mailbox and looks like it worked.
    prompt: "select_account",
  });

  return { url: `${authority(config.tenantId)}/authorize?${params}`, state, verifier };
}

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  id_token?: string;
};

async function postToken(
  config: MicrosoftConfig,
  body: Record<string, string>,
): Promise<{ ok: true; token: TokenResponse } | { ok: false; error: string; permanent: boolean }> {
  const response = await fetch(`${authority(config.tenantId)}/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      ...body,
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (response.ok && typeof payload.access_token === "string") {
    return { ok: true, token: payload as unknown as TokenResponse };
  }

  const code = typeof payload.error === "string" ? payload.error : `http_${response.status}`;
  const description =
    typeof payload.error_description === "string" ? payload.error_description : "";
  // invalid_grant means the refresh token is dead — consent revoked, password
  // changed, the app removed from the tenant. Retrying will never help, and the
  // difference from a network blip decides whether the admin is told to
  // reconnect or told to wait.
  const permanent = code === "invalid_grant" || code === "invalid_client";
  return { ok: false, error: `${code}${description ? `: ${description}` : ""}`, permanent };
}

/** Read the signed-in account out of the id_token without verifying it. */
function accountFromIdToken(idToken: string | undefined): {
  upn: string | null;
  name: string | null;
  tenantId: string | null;
} {
  if (!idToken) return { upn: null, name: null, tenantId: null };
  try {
    const [, payload] = idToken.split(".");
    // Not verified on purpose, and only used for display. The token arrived
    // over TLS from a direct call to Microsoft's token endpoint, not from the
    // browser, so there is nothing here to forge — and nothing in this object
    // authorises anything. The credential is the access token.
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return {
      upn: claims.preferred_username ?? claims.upn ?? null,
      name: claims.name ?? null,
      tenantId: claims.tid ?? null,
    };
  } catch {
    return { upn: null, name: null, tenantId: null };
  }
}

/** Redeem the code from the callback and store the connection. */
export async function completeAuthorization(
  config: MicrosoftConfig,
  code: string,
  verifier: string,
): Promise<{ ok: true; upn: string | null; granted: string[] } | { ok: false; error: string }> {
  const result = await postToken(config, {
    grant_type: "authorization_code",
    code,
    code_verifier: verifier,
  });
  if (!result.ok) return { ok: false, error: result.error };

  const account = accountFromIdToken(result.token.id_token);
  const granted = result.token.scope ? result.token.scope.split(" ").filter(Boolean) : [];

  // No refresh token means offline_access was not granted, and the connection
  // would die within the hour with no way back except another consent. Better
  // to fail the setup now, while he is looking at it.
  if (!result.token.refresh_token) {
    return {
      ok: false,
      error:
        "Microsoft did not return a refresh token, so the connection could not survive an hour. " +
        "Check that offline_access is on the app registration's delegated permissions.",
    };
  }

  const saved = await saveConnection({
    accountUpn: account.upn,
    accountName: account.name,
    tenantId: account.tenantId ?? config.tenantId,
    grantedScopes: granted.length ? granted : [...GRAPH_SCOPES],
    accessToken: result.token.access_token,
    expiresInSeconds: result.token.expires_in,
    refreshToken: result.token.refresh_token,
  });
  if (!saved.ok) return { ok: false, error: `could not store the connection: ${saved.reason}` };

  return { ok: true, upn: account.upn, granted };
}

/**
 * A usable access token, refreshing silently when the stored one has expired.
 *
 * The one function every Graph reader calls. Nothing else in ANA-05, 06 or 07
 * should touch tokens.ts directly — a second place that decides whether a token
 * is still good is a second place that can decide wrong.
 */
export async function accessTokenForGraph(): Promise<
  { ok: true; token: string } | TokenFailure | { ok: false; reason: "needs_consent"; detail: string }
> {
  const config = microsoftConfig();
  if (!config.ok) {
    return { ok: false, reason: "unconfigured", detail: `not set: ${config.missing.join(", ")}` };
  }

  const stored = await readConnection();
  if (!stored.ok) return stored;

  const { connection } = stored;
  if (connection.invalidatedAt) {
    return {
      ok: false,
      reason: "needs_consent",
      detail: connection.invalidatedReason ?? "the connection was invalidated",
    };
  }

  const expiry = connection.accessExpiresAt ? Date.parse(connection.accessExpiresAt) : 0;
  if (connection.accessToken && expiry > Date.now()) {
    return { ok: true, token: connection.accessToken };
  }

  if (!connection.refreshToken) {
    return { ok: false, reason: "needs_consent", detail: "no refresh token is stored" };
  }

  const refreshed = await postToken(config.config, {
    grant_type: "refresh_token",
    refresh_token: connection.refreshToken,
    scope: scopeParameter(),
  });

  if (!refreshed.ok) {
    if (refreshed.permanent) {
      await invalidateConnection(refreshed.error);
      return { ok: false, reason: "needs_consent", detail: refreshed.error };
    }
    return { ok: false, reason: "failed", detail: refreshed.error };
  }

  await saveConnection({
    accountUpn: connection.accountUpn,
    accountName: connection.accountName,
    tenantId: connection.tenantId,
    grantedScopes: refreshed.token.scope
      ? refreshed.token.scope.split(" ").filter(Boolean)
      : connection.grantedScopes,
    accessToken: refreshed.token.access_token,
    expiresInSeconds: refreshed.token.expires_in,
    // Microsoft does not always issue a new one; saveConnection keeps the old.
    refreshToken: refreshed.token.refresh_token ?? null,
  });

  return { ok: true, token: refreshed.token.access_token };
}
