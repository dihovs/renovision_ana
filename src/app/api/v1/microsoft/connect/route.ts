import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isSignedIn } from "@/lib/adminAuth";
import { beginAuthorization, microsoftConfig } from "@/lib/microsoft/auth";
import { hasEncryptionKey } from "@/lib/microsoft/tokens";

/**
 * Start the Microsoft consent flow. (ANA-04)
 *
 *   GET /api/v1/microsoft/connect  →  redirect to login.microsoftonline.com
 *
 * Signed-in admins only. This route hands whoever calls it a consent screen
 * that ends in a credential being written to our database, so it is exactly as
 * sensitive as the admin session itself.
 *
 * REFUSES WITHOUT AN ENCRYPTION KEY, rather than connecting and storing a
 * refresh token in plaintext. A feature that quietly downgrades its own
 * security when half-configured is worse than one that will not start.
 */

const STATE_COOKIE = "rv_ms_state";
const VERIFIER_COOKIE = "rv_ms_verifier";
/** Long enough to read a consent screen, short enough not to linger. */
const MAX_AGE_SECONDS = 10 * 60;

export async function GET() {
  if (!(await isSignedIn())) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }

  const config = microsoftConfig();
  if (!config.ok) {
    return NextResponse.json(
      {
        error: "Microsoft is not configured.",
        missing: config.missing,
        help: "These come from the Entra app registration. See Docs/Microsoft-Graph-Setup.md.",
      },
      { status: 503 },
    );
  }

  if (!hasEncryptionKey()) {
    return NextResponse.json(
      {
        error: "MICROSOFT_TOKEN_KEY is not set, so a refresh token could not be stored safely.",
        help: "Generate one with: openssl rand -hex 32",
      },
      { status: 503 },
    );
  }

  const { url, state, verifier } = beginAuthorization(config.config);

  const store = await cookies();
  const options = {
    httpOnly: true,
    // lax, not strict: the callback arrives as a top-level navigation from
    // Microsoft, and strict would withhold the cookie exactly then.
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  };
  store.set(STATE_COOKIE, state, options);
  store.set(VERIFIER_COOKIE, verifier, options);

  return NextResponse.redirect(url);
}
