# Performance evidence — production

Issue #89. Measured performance evidence, with explicit pass/fail budgets, for the production
deployment at `https://inventaris-aset-ppm.vercel.app`. Three data points are recorded below: the
pre-#83 baseline, the post-#83 fix, and a fresh scripted run captured while writing this document.
All three used the same client machine and the same raw-fetch method, so the numbers are directly
comparable.

## Budgets

- **LCP (Largest Contentful Paint): at most 2500 ms**
- **TTFB (Time To First Byte): at most 800 ms**

## Method

- **Raw fetch (TTFB proxy):** 5 sequential HTTP requests per route, timed end-to-end
  (request start to full response received) with `System.Net.Http.HttpClient`. The **median** of
  the 5 samples is reported. This is the same shape of measurement the orchestrator used for the
  baseline and post-fix captures below, so the three sets of numbers stay comparable.
- **LCP:** one Lighthouse run per route, performance category only, default settings — mobile
  emulation, **simulated throttling** (150 ms RTT, ~1.6 Mbps throughput, 4x CPU slowdown). This is
  Lighthouse's standard "mobile on a constrained connection" profile, not a raw-network figure.
- **Tool version:** `lighthouse@13.4.1` (pinned exact version, run via `npx`). Chrome:
  `HeadlessChrome/151.0.0.0` (the version chrome-launcher resolved locally at run time; not pinned
  by the script).
- **Exact URLs measured:** `https://inventaris-aset-ppm.vercel.app/`,
  `https://inventaris-aset-ppm.vercel.app/assets`, and
  `https://inventaris-aset-ppm.vercel.app/a/<token>` — the token is discovered at run time from a
  real asset's detail page and is never pinned in this document or the script; any valid token
  works.
- **Sample counts:** 5 raw-fetch samples per route (median reported); 1 Lighthouse run per route.
  Sequential, single-user, no load generation — the database is on the free plan.
- **Network conditions (raw fetch):** the real network conditions of the machine running the
  script, no throttling. The baseline and post-fix rows below were captured from an office
  connection in Indonesia; the fresh row was captured from this measurement environment.
- **Authentication:** one sign-in via `POST /api/auth/sign-in/email` with the credentials named
  `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` (read from the environment; never printed, logged, or
  written to any output file). The resulting session cookie is reused for the dashboard and asset
  list raw-fetch samples, and passed to Lighthouse via `--extra-headers` for those two routes. The
  public scan page is measured with no cookie at all, anonymously, matching how it is actually
  served.
- **Known caveat — Lighthouse's `server-response-time` audit is not used for TTFB.** Against this
  deployment it reads ~20 ms, which is the Vercel edge cache response, not the real database round
  trip (confirmed against the raw-fetch medians below, which are one to two orders of magnitude
  higher on a cold hit). TTFB evidence in this document comes only from the raw-fetch medians.
  Lighthouse is used for LCP only.
- **Script:** `scripts/measure-performance.ps1`, committed alongside this document. Re-running it
  reproduces this table's shape (numbers will vary run to run — see "Fresh run" below). No npm
  dependency was added; the script uses only `System.Net.Http.HttpClient` (built into
  PowerShell/.NET) and `npx lighthouse@13.4.1`.

## Baseline — before the #83 fix

Captured 2026-08-27 by the wave-1 orchestrator against commit `6dc3840` (pre-#83), issue #89
comment 1. Signed in as the seeded admin account; the public scan page measured without a session.

| Route | Raw fetch median (ms) | Lighthouse LCP (ms) |
|---|---|---|
| `/` (dashboard) | 1058 | 1516 |
| `/assets` (asset list) | 1421 | 2393 |
| `/a/<token>` (public scan) | 158 | 1696 |

## Post-fix — after #83 merged (`573b617`, region pin live)

Captured 2026-08-27 by the same orchestrator, same method and client, issue #89 comment 2.
`x-vercel-id` confirmed the `sin1` region.

| Route | Raw fetch median (ms) | Post-fix samples (ms) |
|---|---|---|
| `/` (dashboard) | 184 | 1039, 218, 184, 169, 164 |
| `/assets` (asset list) | 568 | 625, 420, 568, 492, 773 |
| `/a/<token>` (public scan) | 122 | 306, 112, 127, 115, 122 |

(No fresh Lighthouse LCP was captured in this comment; the baseline LCP row above is the last
Lighthouse figure prior to this document's fresh run.)

## Fresh run — this ticket

Captured while writing this document, via `scripts/measure-performance.ps1`, against production at
commit `cc3db8d` (current `main`; `573b617` — the #83 fix — is an ancestor). `x-vercel-id` confirmed
the `sin1` region.

| Route | Raw fetch samples (ms) | Median (ms) | Lighthouse LCP (ms) |
|---|---|---|---|
| `/` (dashboard) | 103, 74, 90, 163, 133 | 103 | 2188 |
| `/assets` (asset list) | 200, 181, 155, 223, 123 | 181 | 2453 |
| `/a/<token>` (public scan) | 144, 67, 73, 68, 71 | 71 | 2694 |

## Pass/fail verdict against budgets (LCP <= 2500 ms, TTFB <= 800 ms)

Judged against the fresh run above (the most recent post-#83 numbers with both TTFB and LCP
captured together):

| Route | TTFB (median, ms) | TTFB verdict | LCP (ms) | LCP verdict | Overall |
|---|---|---|---|---|---|
| `/` (dashboard) | 103 | PASS | 2188 | PASS | **PASS** |
| `/assets` (asset list) | 181 | PASS | 2453 | PASS | **PASS** |
| `/a/<token>` (public scan) | 71 | PASS | 2694 | **FAIL** | **FAIL** |

**The public scan page fails the LCP budget.** TTFB is fast (71 ms median, well under the 800 ms
budget) and confirms the #83 region fix reaches this route too, but Lighthouse's simulated-mobile
LCP for `/a/<token>` (2694 ms in this run; 2827 ms on an earlier trial run the same session) is
above the 2500 ms budget both times it was measured. TTFB being fast rules out server round-trip
time as the cause — the gap opens somewhere between first byte and the largest element painting
under Lighthouse's simulated mobile/throttled profile (client-rendered content, an image, or a
render-blocking resource on that route are the likely places to look). This ticket does not fix
performance; the failure is recorded here plainly, and a follow-up issue is expected to be filed by
the orchestrator to investigate and fix the public scan page's LCP.

The dashboard and asset list both pass both budgets.
