import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end configuration only. The single smoke path described in
 * `docs/prd.md` §7.2 (sign in -> create asset -> upload photo -> label print
 * view -> public scan page) is `e2e/label-printing.spec.ts`, added by issue
 * #12. `--pass-with-no-tests` on `npm run test:e2e` stays in place: both
 * specs skip themselves when `E2E_EMAIL`/`E2E_PASSWORD` are unset, which is
 * indistinguishable from "no tests" to this runner.
 *
 * **`PLAYWRIGHT_BASE_URL` also decides whether a server is started.** The
 * deployment cutover (issue #17) runs this same smoke path against a deployed
 * Vercel preview, where starting `npm run dev` would be worse than pointless:
 * Playwright would wait on a local port no test ever visits, and
 * `reuseExistingServer` would quietly accept whatever unrelated development
 * server happened to be listening on it. When the variable is set, the target
 * is somebody else's server and this config starts none. Unset — CI, and every
 * local run — nothing changes.
 *
 * **`VERCEL_AUTOMATION_BYPASS_SECRET` gets past Deployment Protection.** On
 * Vercel's Hobby plan, Vercel Authentication with Standard Protection is on by
 * default: the production domain stays public but every preview deployment and
 * generated deployment URL answers `401` to anyone not signed in to the Vercel
 * account. A browser cannot be signed in to it, so without this the smoke path
 * against a preview fails at the first navigation and reports a broken
 * application rather than a locked door. Protection Bypass for Automation is
 * available on Hobby: the project settings mint a secret, Vercel injects it as
 * this variable, and the two headers below carry it — the first on every
 * request, the second asking Vercel to set a bypass cookie so redirects and
 * sub-resources are covered too. Unset, no headers are sent at all.
 * See `docs/deployment.md` §6.
 */
const DEV_SERVER_PORT = 3000;
const DEV_SERVER_TIMEOUT_MS = 120_000;
const CI_RETRIES = 2;
const CI_WORKERS = 1;

const isCi = Boolean(process.env.CI);
const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL;
const baseURL = externalBaseURL ?? `http://localhost:${DEV_SERVER_PORT}`;

const webServer = externalBaseURL
  ? undefined
  : {
      command: "npm run dev",
      url: baseURL,
      reuseExistingServer: !isCi,
      timeout: DEV_SERVER_TIMEOUT_MS,
    };

const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

const extraHTTPHeaders = bypassSecret
  ? {
      "x-vercel-protection-bypass": bypassSecret,
      "x-vercel-set-bypass-cookie": "true",
    }
  : undefined;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCi,
  retries: isCi ? CI_RETRIES : 0,
  workers: isCi ? CI_WORKERS : undefined,
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL,
    extraHTTPHeaders,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer,
});
