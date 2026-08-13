import { NextResponse } from "next/server";
import { isAuthConfigured, isSignedIn, signIn, signOut, verifyPassword } from "@/lib/adminAuth";

/**
 * Sign in from the native app.
 *
 * The web admin signs in through a server action (`loginAction`), which a
 * native client cannot call — the action id is a build-time hash that
 * changes every deploy. This is the same credential and the same cookie,
 * reached over plain HTTP instead.
 *
 * Nothing about the auth model changes: `verifyPassword` still does the
 * constant-time compare, `signIn` still sets the identical httpOnly
 * `rv_admin` cookie, and an unset ADMIN_PASSWORD still refuses everyone
 * rather than defaulting open. URLSession's cookie storage then carries it
 * on subsequent requests exactly as a browser would.
 */
export async function POST(request: Request) {
  if (!isAuthConfigured) {
    return NextResponse.json({ error: "Admin is not configured." }, { status: 503 });
  }

  let password: unknown;
  try {
    password = ((await request.json()) as { password?: unknown }).password;
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  if (typeof password !== "string" || !password) {
    return NextResponse.json({ error: "Password is required." }, { status: 400 });
  }

  // Deliberately the same generic message whether the password was wrong or
  // malformed — a login endpoint that distinguishes them is a login endpoint
  // that helps someone guess.
  if (!verifyPassword(password)) {
    return NextResponse.json({ error: "That password is not right." }, { status: 401 });
  }

  await signIn();
  return NextResponse.json({ ok: true });
}

/** Whether the cookie this request carried is still valid — the native app's
    "am I still logged in?" check on launch, before showing any screen. */
export async function GET() {
  return NextResponse.json({ signedIn: await isSignedIn() });
}

export async function DELETE() {
  await signOut();
  return NextResponse.json({ ok: true });
}
