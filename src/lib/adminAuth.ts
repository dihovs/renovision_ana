import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

/**
 * Single-user auth for the lead pipeline.
 *
 * This page shows customer names, phone numbers and home addresses, so an
 * unguessable URL is not enough — it needs an actual credential. It is
 * deliberately small: one operator, one password, no accounts to manage.
 *
 * The cookie holds an HMAC of a fixed marker keyed by the password, never the
 * password itself. Changing ADMIN_PASSWORD therefore invalidates every existing
 * session for free, which is the whole recovery story if a laptop goes missing.
 *
 * If ADMIN_PASSWORD is unset the admin area refuses everyone rather than
 * defaulting open — an unconfigured deploy should not publish the lead list.
 */

const COOKIE = "rv_admin";
const MARKER = "renovision-admin-v1";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days — a work phone, re-auth monthly.

function secret(): string | null {
  const password = process.env.ADMIN_PASSWORD;
  return password && password.length > 0 ? password : null;
}

export const isAuthConfigured = Boolean(process.env.ADMIN_PASSWORD);

function tokenFor(password: string): string {
  return createHmac("sha256", password).update(MARKER).digest("hex");
}

/** Constant-time compare so a wrong token can't be discovered by timing. */
function matches(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function verifyPassword(candidate: string): boolean {
  const password = secret();
  if (!password) return false;
  return matches(tokenFor(candidate), tokenFor(password));
}

export async function isSignedIn(): Promise<boolean> {
  const password = secret();
  if (!password) return false;
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return false;
  return matches(token, tokenFor(password));
}

export async function signIn(): Promise<void> {
  const password = secret();
  if (!password) throw new Error("ADMIN_PASSWORD is not set");
  const store = await cookies();
  store.set(COOKIE, tokenFor(password), {
    httpOnly: true,
    sameSite: "lax",
    // Allow http on localhost so the page is testable in development.
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function signOut(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}
