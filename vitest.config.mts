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
  /**
   * `tsconfig.json` sets `jsx: "preserve"`, because Next.js — not tsc — owns the
   * JSX transform for the application build. Vite reads that same field, so
   * without this a test that imports any `.tsx` fails to even parse it:
   * "Failed to parse source for import analysis because the content contains
   * invalid JS syntax." The transform is named here for the test run only, and
   * `tsconfig.json` is left alone.
   *
   * `automatic` is React 19's runtime, the one Next.js compiles with, so a
   * component under test is transformed the way it is in the application.
   *
   * This is Vite 8's `oxc` option, not the `esbuild` one it replaced — Vitest 4
   * runs on Rolldown, and the old key is silently ignored here.
   */
  oxc: {
    jsx: { runtime: "automatic" },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    exclude: ["node_modules/**", ".next/**", "e2e/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/lib/**/*.ts", "src/lib/**/*.tsx"],
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.test.tsx",
        "src/generated/**",
        // The three architectural seams. Each is configuration wiring with no
        // branching logic of its own — a Prisma client behind a driver adapter,
        // and the two Better Auth configurations — so a unit test could only
        // assert that the library was called with the object it was given. That
        // buys a coverage number, not confidence. The behaviour these modules
        // carry is proven end to end instead: by the Playwright smoke path,
        // which performs a real sign-in.
        "src/lib/db.ts",
        "src/lib/auth.ts",
        "src/lib/auth-client.ts",
      ],
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
