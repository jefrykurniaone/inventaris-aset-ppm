import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

/**
 * Unit tests only. Tests are co-located with their source as `*.test.ts`.
 *
 * The coverage gate is deliberately scoped to `src/lib/**` â€” the business
 * logic and utilities the standard asks to be covered â€” rather than to the
 * whole application. Glob thresholds do not inherit global ones in Vitest,
 * and no global threshold is set, so pages and components are reported but
 * not gated.
 */
const LIB_COVERAGE_THRESHOLD = 90;

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    exclude: ["node_modules/**", ".next/**", "e2e/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/lib/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/generated/**"],
      thresholds: {
        "src/lib/**": {
          statements: LIB_COVERAGE_THRESHOLD,
          branches: LIB_COVERAGE_THRESHOLD,
          functions: LIB_COVERAGE_THRESHOLD,
          lines: LIB_COVERAGE_THRESHOLD,
        },
      },
    },
  },
});
