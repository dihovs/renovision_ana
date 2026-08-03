import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vendored agent tooling: third-party skill scripts and scratch worktrees
    // that happen to live inside the repo. Not project source, and their lint
    // errors drown out the ones that are ours to fix.
    ".claude/**",
  ]),
]);

export default eslintConfig;
