import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

import { STATIC_SECURITY_HEADERS } from "./src/lib/security-headers";

/** Every path, so build chunks and optimised images are covered too. */
const ALL_ROUTES = "/(.*)";

const nextConfig: NextConfig = {
  /**
   * `X-Powered-By: Next.js` is a free fingerprint of the framework and its
   * major version. The ZAP baseline of 2026-08-27 raised it on all five
   * document routes, and issue #113 folded it in rather than opening a
   * near-duplicate (`docs/security-review-2026-08-27.md` §9.2).
   */
  poweredByHeader: false,

  /**
   * The constant security response headers (issue #113, finding F-03). Their
   * values and the reasoning behind each live in
   * `src/lib/security-headers.ts`.
   *
   * Applied to every path rather than to documents only: the baseline scan
   * raised `X-Content-Type-Options` on fifteen URLs, most of them
   * `_next/static` chunks, and a `headers()` entry is the only one of the two
   * mechanisms that reaches those. The Content-Security-Policy is the
   * exception and lives in `src/middleware.ts`, because its nonce has to
   * change per request and this file is evaluated once at build time.
   */
  async headers() {
    return [{ source: ALL_ROUTES, headers: [...STATIC_SECURITY_HEADERS] }];
  },

  images: {
    /**
     * Asset photos are read from a public Supabase Storage bucket
     * (ADR 0005), so `next/image` has to be told the host is allowed.
     *
     * A wildcard host rather than `SUPABASE_URL`: the value is server-side
     * configuration that CI does not hold, and a build whose image policy
     * depends on an absent variable silently produces a deployment that
     * refuses its own images. The path is narrowed instead — only the public
     * object route of a Supabase project can match.
     *
     * The components render these with `unoptimized`, because the pipeline
     * already stores exactly-sized derivatives and routing each render
     * through the optimiser is the egress cost PRD risk R2 exists to avoid.
     * This entry is what keeps that a rendering choice rather than the only
     * thing standing between the page and a blocked image.
     */
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

// Reads `src/i18n/request.ts` by convention — see that file for why there is
// no `[locale]` route segment and no `next-intl` middleware.
const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
