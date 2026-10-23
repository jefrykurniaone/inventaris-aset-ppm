import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

import { PHOTO_ROUTE_PREFIX } from "./src/lib/photo-address";
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
     * No `remotePatterns`: photos are stored in PostgreSQL and served from
     * this application's own `/api/photos/<id>/<variant>` route (ADR 0009), so
     * the optimiser has no remote host to fetch from and a `/_next/image?url=`
     * pointing at someone else's server answers 400.
     *
     * `localPatterns` narrows the optimiser to that route. The only
     * optimised image is the public scan page's full-size photo, which is its
     * Largest Contentful Paint element (issue #110); every other `next/image`
     * is `unoptimized` and never reaches `/_next/image`, and `public/` holds
     * no image. `search: ""` because photo addresses carry no query string
     * (`photoAddress` in `src/lib/photo-address.ts`).
     *
     * The prefix is imported by relative path because this file is evaluated
     * before the `@/` alias exists.
     */
    localPatterns: [{ pathname: `${PHOTO_ROUTE_PREFIX}/**`, search: "" }],
  },
};

// Reads `src/i18n/request.ts` by convention — see that file for why there is
// no `[locale]` route segment and no `next-intl` middleware.
const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
