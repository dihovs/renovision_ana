import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isSignedIn } from "@/lib/adminAuth";
import { completeAuthorization, microsoftConfig } from "@/lib/microsoft/auth";
import { missingScopes } from "@/lib/microsoft/scopes";

/**
 * Where Microsoft sends the owner back. (ANA-04)
 *
 *   GET /api/v1/microsoft/callback?code=...&state=...
 *
 * Three things are checked before the code is redeemed, and each one is a way
 * this could otherwise go wrong quietly:
 *
 * 1. The admin session. A callback is a plain GET anybody can request.
 * 2. The state, compared against the cookie set at /connect. Without it, a link
 *    someone else crafted could complete a consent into this session and
 *    connect an account the owner never chose.
 * 3. The PKCE verifier, which proves this is the same browser that started.
 *
 * The cookies are cleared whatever happens, so a failed attempt cannot leave a
 * usable state value behind for a second try.
 */

const STATE_COOKIE = "rv_ms_state";
const VERIFIER_COOKIE = "rv_ms_verifier";

function back(request: Request, params: Record<string, string>) {
  const url = new URL("/admin", new URL(request.url).origin);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  if (!(await isSignedIn())) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }

  const store = await cookies();
  const expectedState = store.get(STATE_COOKIE)?.value ?? null;
  const verifier = store.get(VERIFIER_COOKIE)?.value ?? null;
  store.delete(STATE_COOKIE);
  store.delete(VERIFIER_COOKIE);

  const params = new URL(request.url).searchParams;

  // Microsoft reports a refused or cancelled consent here rather than by
  // failing the redirect, so this is the ordinary "he clicked Cancel" path.
  const error = params.get("error");
  if (error) {
    const description = params.get("error_description") ?? "";
    return back(request, { microsoft: "error", reason: `${error}: ${description}`.slice(0, 300) });
  }

  const code = params.get("code");
  const state = params.get("state");
  if (!code || !state) {
    return back(request, { microsoft: "error", reason: "Microsoft returned no authorisation code." });
  }
  if (!expectedState || state !== expectedState) {
    return back(request, {
      microsoft: "error",
      reason: "The sign-in did not match the one this browser started. Try connecting again.",
    });
  }
  if (!verifier) {
    return back(request, {
      microsoft: "error",
      reason: "The sign-in took too long and had to be restarted.",
    });
  }

  const config = microsoftConfig();
  if (!config.ok) {
    return back(request, { microsoft: "error", reason: `not configured: ${config.missing.join(", ")}` });
  }

  const result = await completeAuthorization(config.config, code, verifier);
  if (!result.ok) return back(request, { microsoft: "error", reason: result.error.slice(0, 300) });

  // A narrower grant than we asked for is not a failure, but it must not pass
  // silently: a missing Mail.Read shows up later as an empty mailbox, which
  // reads exactly like "he was never emailed about it".
  const short = missingScopes(result.granted);
  return back(request, {
    microsoft: "connected",
    account: result.upn ?? "",
    ...(short.length ? { missingScopes: short.join(",") } : {}),
  });
}
