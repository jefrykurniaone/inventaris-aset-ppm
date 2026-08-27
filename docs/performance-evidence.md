# Performance evidence — production

Issues #89 and #110. Measured performance evidence, with explicit pass/fail budgets, for the
production deployment at `https://inventaris-aset-ppm.vercel.app`. Recorded below: the pre-#83
baseline, the post-#83 fix, the #89 fresh run that failed the LCP budget on the public scan page,
and the two post-#110 runs that clear it. All used the same client machine and the same raw-fetch
method, so the numbers are directly comparable.

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
  reproduces this table's shape (numbers will vary run to run — see the runs below). No npm
  dependency was added; the script uses only `System.Net.Http.HttpClient` (built into
  PowerShell/.NET) and `npx lighthouse@13.4.1`.
- **Warm the image cache before a run that is meant as evidence.** Since #110 the public scan
  page's LCP element is served through `/_next/image`, and Vercel's image cache is per
  (photo, width). A cold miss makes the single Lighthouse run measure a transcode from Supabase
  rather than the cached path a real scan gets. Loading `/a/<token>` once beforehand is enough.
  Both states are recorded below so the difference is visible rather than assumed; the stored
  objects carry `Cache-Control: public, max-age=31536000, immutable` and their paths are
  content-addressed, so each (photo, width) pair is transcoded once and then served warm
  indefinitely.
- **The script also reports which element each route's LCP was measured against.** Worth knowing
  which audit that comes from: `largest-contentful-paint-element` **does not exist** in
  `lighthouse@13.4.1`. Version 13 replaced it with the insight audits, so the element is read from
  `lcp-discovery-insight` (scored) or `lcp-breakdown-insight` (informative), where the node is a
  direct `type: "node"` member of `details.items` rather than nested in a table row. Reading the
  removed id returns `$null` and prints `unknown` for every route, which is exactly what the first
  post-#110 attempt did. `$LCP_ELEMENT_AUDIT_IDS` in the script tries all three ids, newest first.

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

## Fresh run — issue #89, before the #110 fix

Captured while writing this document, via `scripts/measure-performance.ps1`, against production at
commit `cc3db8d` (`main` at the time; `573b617` — the #83 fix — is an ancestor). `x-vercel-id`
confirmed the `sin1` region.

| Route | Raw fetch samples (ms) | Median (ms) | Lighthouse LCP (ms) |
|---|---|---|---|
| `/` (dashboard) | 103, 74, 90, 163, 133 | 103 | 2188 |
| `/assets` (asset list) | 200, 181, 155, 223, 123 | 181 | 2453 |
| `/a/<token>` (public scan) | 144, 67, 73, 68, 71 | 71 | **2694** |

This is the run that failed the LCP budget on the public scan page and became issue #110. Two
further measurements of the same route in the same session read 2827 ms and 2917 ms, so the miss
was not a single outlier.

## Post-fix run — issue #110, commit `bf2197b`

Captured 2026-08-27 against production at commit `bf2197b` (the #110 merge), same script, same
client, same profile and the same `lighthouse@13.4.1` as the fresh run above, so these numbers are
directly comparable to it. Two full runs were taken because the scan page's LCP element now goes
through Vercel's image optimiser and the first run found that cache cold — see the cold/warm note
in the method section.

**Run 1 — cold Vercel image cache.** Only medians were captured for TTFB in these two runs; the
per-sample lists are not recorded here rather than reconstructed.

| Route | TTFB (median, ms) | TTFB verdict | LCP (ms) | LCP verdict |
|---|---|---|---|---|
| `/` (dashboard) | 140 | PASS | 2555 | **FAIL** |
| `/assets` (asset list) | 275 | PASS | 1935 | PASS |
| `/a/<token>` (public scan) | 93 | PASS | 1847 | PASS |

**Run 2 — warm image cache. This is the evidence run**; the script exited 0, meaning every route
passed both budgets.

| Route | TTFB (median, ms) | TTFB verdict | LCP (ms) | LCP verdict |
|---|---|---|---|---|
| `/` (dashboard) | 154 | PASS | 2295 | PASS |
| `/assets` (asset list) | 317 | PASS | 1578 | PASS |
| `/a/<token>` (public scan) | 100 | PASS | 1705 | PASS |

The public scan page went from 2694–2917 ms to **1705 ms warm and 1847 ms cold** — under the
2500 ms budget on both runs, so it does not depend on a warm cache to pass. The asset list improved
too (2453 → 1578 ms), which #110 did not touch; that is run-to-run and network variance, not a
claimed effect of the fix.

The dashboard's 2555 ms in run 1 is the one FAIL anywhere in the two runs. It is a route #110 did
not touch, it passed at 2188 ms before the fix and 2295 ms in run 2, and nothing in the #110 diff
reaches it — the scan page's own gallery component, the `next.config.ts` comment, and this script.
Recorded here rather than dropped, and it puts the dashboard within ~250 ms of the budget across
three measurements, which is thin enough to be worth its own ticket if the margin matters.

## Pass/fail verdict against budgets (LCP <= 2500 ms, TTFB <= 800 ms)

Judged against run 2 above, the most recent run with both TTFB and LCP captured together:

| Route | TTFB (median, ms) | TTFB verdict | LCP (ms) | LCP verdict | Overall |
|---|---|---|---|---|---|
| `/` (dashboard) | 154 | PASS | 2295 | PASS | **PASS** |
| `/assets` (asset list) | 317 | PASS | 1578 | PASS | **PASS** |
| `/a/<token>` (public scan) | 100 | PASS | 1705 | PASS | **PASS** |

**All three routes pass both budgets.** The public scan page failure recorded by #89 and fixed by
#110 is closed out by these numbers.

## What the #110 fix was, in one paragraph

The LCP element on `/a/<token>` is the full-size asset photo. It rendered `unoptimized`, so a
125,866-byte 1200x1600 derivative was fetched from the storage host for a slot 380 CSS px wide, and
that host is a second origin — a DNS, TCP and TLS handshake stood in front of the first byte.
`priority` on its own does not mark the preload urgent either: `next/image` passes `fetchPriority`
through and defaults it to nothing, so the LCP element shared the throttled throughput with roughly
137 KB of `async` scripts at no advantage. The fix routes that one photo through the optimiser
(same-origin `/_next/image`, and 24,586 bytes at the width the mobile profile picks) and adds
`fetchPriority="high"`. Thumbnails were left `unoptimized`.

### Element-level confirmation

A separate single-route Lighthouse run against the same deployment, taken to fix the element
reporting in the script (see the method note below), read the LCP element on `/a/<token>` as:

```
<img alt="…" fetchpriority="high" width="1200" height="1600" decoding="async" data-nimg="1"
  class="border-border h-auto w-full rounded-md border object-contain"
  sizes="(min-width: 672px) 640px, calc(100vw - 2rem)"
  srcset="/_next/image?url=https%3A%2F%2F…supabase.co%2Fstorage%…"
  src="https://inventaris-aset-ppm.vercel.app/_next/image?url=…">
```

That is the fix visible in the measured artefact rather than only in the diff: `fetchpriority`
present, `sizes` present, and the `src` same-origin through `/_next/image`. LCP on that run was
1774 ms. Lighthouse's `lcp-discovery-insight` checklist passed all three of its items —
`fetchpriority=high applied`, `Request is discoverable in initial document`, and
`LCP resources should not use loading=lazy` — and `lcp-breakdown-insight` split the 1774 ms into
172 ms time to first byte, 597 ms resource load delay, 192 ms resource load duration, and 52 ms
element render delay. The 192 ms load duration is the optimised image; it was the dominant term
before the fix.
