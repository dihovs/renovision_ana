import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Pure-logic tests only: node environment, no jsdom, no Next.js runtime.
export default defineConfig({
  resolve: {
    // Mirrors the `@/*` path alias in tsconfig.json.
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
