import { createSign } from "node:crypto";
import http2 from "node:http2";
import { db } from "@/lib/crm/db";

/**
 * Real push notifications, through Apple.
 *
 * **Why this is not a `fetch`.** APNs speaks HTTP/2 only, and Node's built-in
 * `fetch` (undici) does not do HTTP/2 at all. So this opens an `http2`
 * session directly — which also means any route calling it must run on the
 * Node runtime rather than Edge.
 *
 * **The credential.** Apple issues a `.p8` signing key, once, and never lets
 * it be downloaded again. It signs a short-lived ES256 JWT that rides every
 * request. Three environment variables and nothing is stored in the repo:
 *
 * - `APNS_KEY_P8` — the file's contents, newlines and all
 * - `APNS_KEY_ID` — the ten characters from its filename
 * - `APNS_TEAM_ID` — from the top of the developer portal
 *
 * Unset means push is OFF, which is a valid state and not an error: the SMS
 * alerts in `owner.ts` carry the same news and need nothing from Apple.
 */

const BUNDLE_ID = process.env.APNS_BUNDLE_ID?.trim() || "ca.renovisionana.crm";

/** Sandbox for anything signed with a development profile, which is what a
    cabled build from Xcode is. Getting this wrong is the commonest reason
    push silently fails: a token minted against one gateway is rejected flat
    by the other. */
function gateway(environment: string): string {
  return environment === "production"
    ? "https://api.push.apple.com"
    : "https://api.sandbox.push.apple.com";
}

export function isPushConfigured(): boolean {
  return Boolean(
    process.env.APNS_KEY_P8?.trim() &&
      process.env.APNS_KEY_ID?.trim() &&
      process.env.APNS_TEAM_ID?.trim(),
  );
}

/**
 * The provider token. Apple accepts one for an hour and refuses a request
 * more than an hour old, so this is cached just under that — minting one per
 * notification is allowed but Apple rate-limits it.
 */
let cached: { token: string; mintedAt: number } | null = null;

function providerToken(): string | null {
  const p8 = process.env.APNS_KEY_P8?.trim();
  const keyId = process.env.APNS_KEY_ID?.trim();
  const teamId = process.env.APNS_TEAM_ID?.trim();
  if (!p8 || !keyId || !teamId) return null;

  const now = Math.floor(Date.now() / 1000);
  if (cached && now - cached.mintedAt < 50 * 60) return cached.token;

  const header = { alg: "ES256", kid: keyId };
  const claims = { iss: teamId, iat: now };
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const signingInput = `${encode(header)}.${encode(claims)}`;

  try {
    // `ieee-p1363` is what makes this a JWS signature rather than DER — the
    // raw r‖s pair JOSE expects. Node defaults to DER, and Apple rejects it
    // with a message that says nothing useful about why.
    const signature = createSign("SHA256")
      .update(signingInput)
      .sign(
        {
          key: p8.includes("\\n") ? p8.replace(/\\n/g, "\n") : p8,
          dsaEncoding: "ieee-p1363",
        },
        "base64url",
      );
    cached = { token: `${signingInput}.${signature}`, mintedAt: now };
    return cached.token;
  } catch (error) {
    console.error("[push] could not sign the provider token:", (error as Error).message);
    return null;
  }
}

type Device = { token: string; environment: string };

async function liveDevices(): Promise<Device[]> {
  const supabase = db();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("device_tokens")
    .select("token, environment")
    .is("disabled_at", null);
  if (error) {
    // A table that is not there yet is a routine state in this project.
    console.error("[push] could not read device tokens:", error.message);
    return [];
  }
  return (data ?? []) as Device[];
}

async function disable(token: string, reason: string): Promise<void> {
  const supabase = db();
  if (!supabase) return;
  await supabase
    .from("device_tokens")
    .update({ disabled_at: new Date().toISOString(), disabled_reason: reason })
    .eq("token", token);
}

/** One notification to one device. Resolves either way; never throws. */
function deliver(
  device: Device,
  payload: Record<string, unknown>,
  jwt: string,
): Promise<void> {
  return new Promise((resolve) => {
    const session = http2.connect(gateway(device.environment));
    const body = JSON.stringify(payload);
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      session.close();
      resolve();
    };

    session.on("error", (error) => {
      console.error("[push] session error:", error.message);
      done();
    });

    const request = session.request({
      ":method": "POST",
      ":path": `/3/device/${device.token}`,
      authorization: `bearer ${jwt}`,
      "apns-topic": BUNDLE_ID,
      "apns-push-type": "alert",
      // Notifications about a lead are worth waking the screen for; nothing
      // here is a background refresh.
      "apns-priority": "10",
      "content-type": "application/json",
      "content-length": Buffer.byteLength(body),
    });

    let status = 0;
    let text = "";
    request.on("response", (headers) => {
      status = Number(headers[":status"] ?? 0);
    });
    request.setEncoding("utf8");
    request.on("data", (chunk: string) => {
      text += chunk;
    });
    request.on("error", (error) => {
      console.error("[push] request error:", error.message);
      done();
    });
    request.on("end", async () => {
      if (status === 410 || (status === 400 && text.includes("BadDeviceToken"))) {
        // The app was deleted, or the token belongs to the other gateway.
        // Retiring it is what stops every future send wasting a round trip.
        await disable(device.token, text || `status ${status}`);
      } else if (status !== 200) {
        console.error("[push] Apple refused:", status, text);
      }
      done();
    });
    request.end(body);
  });
}

/**
 * Push to every live device.
 *
 * Fire-and-forget from the caller's point of view — see `owner.ts` for the
 * argument, which is the same one: whatever triggered this matters more than
 * telling somebody about it.
 */
export function push(input: {
  title: string;
  body: string;
  /** Deep link the tap should open, e.g. `/admin/leads`. */
  path?: string;
  /** Bumps the red number on the icon. */
  badge?: number;
}): void {
  void (async () => {
    const jwt = providerToken();
    if (!jwt) return;
    const devices = await liveDevices();
    if (devices.length === 0) return;

    const payload: Record<string, unknown> = {
      aps: {
        alert: { title: input.title, body: input.body },
        sound: "default",
        ...(input.badge != null ? { badge: input.badge } : {}),
      },
      ...(input.path ? { path: input.path } : {}),
    };

    await Promise.all(devices.map((device) => deliver(device, payload, jwt)));
  })();
}
