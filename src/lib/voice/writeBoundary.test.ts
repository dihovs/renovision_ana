import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PERMITTED_CRM_WRITES } from "./ownerTools";

/**
 * The write boundary, enforced instead of described. (ANA-01)
 *
 * Ana drafts, she never issues. The comment at the top of `ownerTools.ts` says
 * so, and a comment is worth nothing on its own — this file is what makes the
 * sentence true. It has already been true and then quietly false once:
 * `Docs/Voice-Owner-Mode.md` spent weeks claiming Ana writes "exactly one
 * thing" after `queue_customer_call` made it two.
 *
 * HOW IT WORKS. A handler cannot call what the module does not import. So the
 * check is on the imports: read `ownerTools.ts` as text, take every symbol it
 * pulls out of `@/lib/...`, work out which of those are writes by looking at
 * how they are declared in `src/lib`, and fail if any write is not written down
 * in PERMITTED_CRM_WRITES.
 *
 * Adding `sendInvoice` to the imports therefore does not produce a working
 * feature. It produces a red test naming the function.
 *
 * WHAT IT DOES NOT CATCH, stated plainly so nobody trusts it further than it
 * goes: a dynamic `await import()`, a write re-exported from a module under a
 * reading name, or raw SQL through `db()`. There is deliberately no query tool
 * (see `ownerTools.ts`), and those three would each be a strange thing to write
 * by accident — but they are the gap, and a reviewer still has to look.
 */

const SRC_LIB = fileURLToPath(new URL("../", import.meta.url));
const OWNER_TOOLS = fileURLToPath(new URL("./ownerTools.ts", import.meta.url));

/**
 * A verb that changes something, followed by a capital.
 *
 * The capital matters: `recordPayment` is a write, `recentTeamMessages` and
 * `receivablesSummary` are not, and only the word boundary tells them apart.
 */
const WRITE_VERB =
  /^(create|update|delete|send|set|record|approve|queue|dispatch|seed|run|request|write|insert|remove|archive|cancel|apply|merge|patch|save|sync)[A-Z]/;

/** Named one by one, because these must never be reachable, in any order. */
const NEVER = [
  "sendQuote", // a document leaves the building
  "sendInvoice", // ditto, and it asks for money
  "recordPayment", // money
  "deletePayment", // money, backwards
  "setQuoteStatus", // decides on the customer's behalf
  "setInvoiceStatus",
  "approveQuoteByToken", // acts AS the customer
  "requestChangesByToken",
];

function tsFilesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = `${dir}${entry.name}`;
    if (entry.isDirectory()) out.push(...tsFilesUnder(`${path}/`));
    else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) out.push(path);
  }
  return out;
}

/** Every exported function in `src/lib` whose name says it changes something. */
function writeFunctions(): Set<string> {
  const found = new Set<string>();
  for (const file of tsFilesUnder(SRC_LIB)) {
    const source = readFileSync(file, "utf8");
    for (const [, name] of source.matchAll(/^export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)/gm)) {
      if (WRITE_VERB.test(name)) found.add(name);
    }
  }
  return found;
}

/** Every value (not type) `ownerTools.ts` imports from `@/lib`. */
function ownerToolImports(): string[] {
  const source = readFileSync(OWNER_TOOLS, "utf8");
  const names: string[] = [];
  for (const [, clause, from] of source.matchAll(
    /import\s+(?:type\s+)?\{([^}]+)\}\s*from\s*["']([^"']+)["']/g,
  )) {
    if (!from.startsWith("@/lib")) continue;
    for (const raw of clause.split(",")) {
      const spec = raw.trim();
      if (!spec || spec.startsWith("type ")) continue;
      names.push(spec.split(/\s+as\s+/)[0].trim());
    }
  }
  return names;
}

describe("Ana's write boundary", () => {
  it("finds the write functions it is supposed to be guarding against", () => {
    // A guard that matches nothing passes forever. This is the canary: if the
    // scan breaks, this fails before the real assertions go quietly green.
    const writes = writeFunctions();
    expect(writes.has("sendInvoice")).toBe(true);
    expect(writes.has("createOwnerTask")).toBe(true);
    expect(writes.has("receivablesSummary")).toBe(false);
    expect(writes.has("recentTeamMessages")).toBe(false);
  });

  it("imports no write that is not on the permitted list", () => {
    const writes = writeFunctions();
    const permitted: readonly string[] = PERMITTED_CRM_WRITES;
    const unlisted = ownerToolImports().filter((n) => writes.has(n) && !permitted.includes(n));

    expect(
      unlisted,
      `ownerTools.ts imports ${unlisted.join(", ")}, which change data and are not in ` +
        `PERMITTED_CRM_WRITES. If Ana should be able to do this, add the name there ` +
        `deliberately — after checking the owner can undo it in ten seconds from the admin. ` +
        `If she should not, remove the import.`,
    ).toEqual([]);
  });

  it("keeps no stale names on the permitted list", () => {
    // A permitted write nobody imports is a door left open onto an empty room.
    const imported = new Set(ownerToolImports());
    const stale = PERMITTED_CRM_WRITES.filter((n) => !imported.has(n));
    expect(stale, `PERMITTED_CRM_WRITES lists ${stale.join(", ")}, which nothing imports`).toEqual(
      [],
    );
  });

  it("cannot reach anything that sends, deletes, takes money or decides a status", () => {
    const imported = ownerToolImports();
    for (const forbidden of NEVER) {
      expect(imported, `ownerTools.ts must never import ${forbidden}`).not.toContain(forbidden);
    }
    const destructive = imported.filter((n) => /^delete[A-Z]/.test(n) || /Archived$/.test(n));
    expect(destructive, `ownerTools.ts must never import ${destructive.join(", ")}`).toEqual([]);
  });
});
