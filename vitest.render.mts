import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Config for the report-render scripts — `*.render.test.tsx` files like
 * `src/components/admin/tansley-report.render.test.tsx` — that render a real
 * React report component (JSX) to static HTML for a worked sample. The main
 * `vitest.config.mts` only includes `src/**\/*.test.ts` on purpose (pure
 * logic, no JSX, no DOM); this sits beside it rather than widening that one,
 * so the fast default test run stays exactly what it was.
 *
 * Run with: npx vitest run --config vitest.render.mts
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.render.test.tsx"],
    // These scripts now print the PDF as well as the HTML — a headless
    // Chrome start plus a twenty-page paginated document is well past the
    // five-second default, and a timeout here looks like a broken report
    // rather than a slow one.
    testTimeout: 180_000,
    hookTimeout: 180_000,
  },
});
