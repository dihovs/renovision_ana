import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The second authenticated door, held to what its comment promises. (ANA-20)
 *
 * `ADMIN_OWNER_SESSION` asserts `authenticated: true` without a phone call,
 * which is safe for one reason only: whoever holds the admin cookie can
 * already send invoices and delete clients with one click, so Ana's draft-only
 * subset adds nothing. That reasoning holds exactly as long as the constant is
 * used behind an `isSignedIn()` check — and the comment on it promises there
 * is one such caller. This is the test that makes the promise cost something.
 */

const SRC = fileURLToPath(new URL("../../", import.meta.url));

function tsFilesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = `${dir}${entry.name}`;
    if (entry.isDirectory()) out.push(...tsFilesUnder(`${path}/`));
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(path);
  }
  return out;
}

/** Files that import the constant, other than the module that defines it. */
function callers(): string[] {
  return tsFilesUnder(SRC).filter((file) => {
    if (file.endsWith("/lib/voice/owner.ts")) return false;
    return /\bADMIN_OWNER_SESSION\b/.test(readFileSync(file, "utf8"));
  });
}

describe("ADMIN_OWNER_SESSION", () => {
  it("has exactly one caller, and it is the admin assistant route", () => {
    const found = callers().map((f) => f.slice(SRC.length));
    expect(
      found,
      "A second caller was added. That is allowed, but it has to be deliberate: it must " +
        "check isSignedIn() in the same request, and this test updated to name it.",
    ).toEqual(["app/api/admin/assistant/route.ts"]);
  });

  it("is used only in a file that checks isSignedIn in the same request", () => {
    for (const file of callers()) {
      const source = readFileSync(file, "utf8");
      expect(source, `${file} uses ADMIN_OWNER_SESSION without an isSignedIn() gate`).toMatch(
        /isSignedIn\(\)/,
      );
    }
  });

  it("guards against the gate being deleted while the constant stays", () => {
    // The specific shape that matters: an early return when NOT signed in.
    const route = readFileSync(`${SRC}app/api/admin/assistant/route.ts`, "utf8");
    expect(route).toMatch(/if\s*\(!\(await isSignedIn\(\)\)\)/);
  });
});
