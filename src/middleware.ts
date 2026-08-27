import { NextResponse, type NextRequest } from "next/server";

import {
  buildContentSecurityPolicy,
  createCspNonce,
  CSP_HEADER_NAME,
} from "@/lib/security-headers";

/**
 * Sets the Content-Security-Policy (issue #113). The policy itself and the
 * reasoning behind every directive live in `src/lib/security-headers.ts`;
 * this file exists only because a nonce has to be minted per request, which
 * `next.config.ts` cannot do — it is evaluated once, at build time. The
 * constant headers stay there for that reason.
 *
 * The policy is set on the *request* as well as the response, and that is not
 * redundant. Next.js reads the nonce back out of the request header and
 * applies it to every inline script it renders, which is the whole reason a
 * strict `script-src` can work at all on an App Router page.
 *
 * This costs no rendering strategy. Every route in this application is
 * already server-rendered on demand — the root layout reads the theme cookie
 * for every route, public ones included — so nothing here moves a page off
 * static prerendering, and the public scan page's caching behaviour (#110)
 * is unchanged.
 *
 * This is also the only middleware in the repository. It performs no auth
 * check by design: authorisation is checked server-side inside each route
 * (`src/lib/require-user.ts`), and the security review's A01 section is built
 * on that being the single place it happens.
 */
export function middleware(request: NextRequest): NextResponse {
  const nonce = createCspNonce();
  const policy = buildContentSecurityPolicy({
    nonce,
    isDevelopment: process.env.NODE_ENV !== "production",
  });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(CSP_HEADER_NAME, policy);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set(CSP_HEADER_NAME, policy);
  return response;
}

export const config = {
  matcher: [
    {
      /*
       * Documents only. A CSP on a build chunk, an optimised image, an icon
       * or the vendored compression worker governs nothing, and every path
       * excluded here is one fewer middleware invocation per page view. The
       * headers those responses *do* need — `nosniff` above all, which the
       * ZAP baseline raised on the chunks themselves — come from
       * `next.config.ts` instead, which covers them.
       */
      source:
        "/((?!api|_next/static|_next/image|vendor|favicon.ico|icon.svg).*)",
      /*
       * `next/link` prefetches fetch an RSC payload rather than a document.
       * The router applies that payload through the DOM, never through an
       * inline script, so there is nothing on it for a policy to protect —
       * and prefetches are frequent enough that running the middleware for
       * them would be the bulk of its invocations.
       */
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
