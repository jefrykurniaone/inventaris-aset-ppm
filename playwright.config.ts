import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end configuration only. The single smoke path described in
 * `docs/prd.md` §7.2 (sign in -> create asset -> upload photo -> label print
 * view -> public scan page) is `e2e/label-printing.spec.ts`, added by issue
 * #12. `--pass-with-no-tests` on `npm run test:e2e` stays in place: both
 * specs skip themselves when `E2E_EMAIL`/`E2E_PASSWORD` are unset, which is
 * indistinguishable from "no tests" to this runner.
 */
const DEV_SERVER_PORT = 3000;
const DEV_SERVER_TIMEOUT_MS = 120_000;
const CI_RETRIES = 2;
const CI_WORKERS = 1;

const isCi = Boolean(process.env.CI);
const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${DEV_SERVER_PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCi,
  retries: isCi ? CI_RETRIES : 0,
  workers: isCi ? CI_WORKERS : undefined,
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: baseURL,
    reuseExistingServer: !isCi,
    timeout: DEV_SERVER_TIMEOUT_MS,
  },
});
