import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

/**
 * Unit tests only. Tests are co-located with their source as `*.test.ts`.
 *
 * The coverage gate is deliberately scoped to `src/lib/**` — the business
 * logic and utilities the standard asks to be covered — rather than to the
 * whole application. `coverage.include` narrows instrumentation to that
 * directory, so pages and components are neither gated nor reported: they do
 * not appear in the coverage table at all. Widening the gate to the whole
 * application is a separate decision, and would need a global threshold —
 * glob thresholds do not inherit one in Vitest, and none is set here.
 *
 * The include covers `.ts` and `.tsx` so that a component placed under
 * `src/lib` cannot slip past the gate unnoticed.
 *
 * `@vitest/coverage-v8` 4.x prints an empty per-file text table even when
 * files are instrumented; `coverage/lcov.info` is the per-file source of
 * truth, and the summary totals below it are real.
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
      include: ["src/lib/**/*.ts", "src/lib/**/*.tsx"],
      exclude: ["src/**/*.test.ts", "src/**/*.test.tsx", "src/generated/**"],
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
