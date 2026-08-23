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
  {
    rules: {
      // Honour the leading-underscore convention the codebase already uses.
      //
      // Some parameters cannot be deleted: a `useActionState` action must
      // accept `prevState` whether or not it reads it, and a mock standing in
      // for an SDK method has to match that method's shape. Naming those `_x`
      // is how the code says "required, deliberately unused" — without this
      // the linter demanded the one change that would break them.
      //
      // Destructuring siblings are ignored too, which is what makes
      // `const { a, ...rest } = obj` usable for dropping a key.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
    },
  },
]);

export default eslintConfig;
