/**
 * The application's HTTP security response headers (issue #113, finding F-03
 * of `docs/security-review-2026-08-27.md` §8 A05 and §9.2).
 *
 * Two consumers, and the split is deliberate:
 *
 *  - the constant headers go through `next.config.ts`'s `headers()`, which
 *    covers *every* response including `/_next/static/*`. The ZAP baseline
 *    raised `X-Content-Type-Options` on fifteen URLs, most of them build
 *    chunks, so a header set only on documents would not have cleared it;
 *  - the Content-Security-Policy goes through `src/middleware.ts`, because it
 *    carries a per-request nonce and `next.config.ts` is evaluated once at
 *    build time.
 *
 * `Strict-Transport-Security` is **not** here. Vercel already serves
 * `max-age=63072000; includeSubDomains; preload` on this deployment, and a
 * second one would only be a duplicate to keep in step.
 */

/**
 * Nonce length in bytes. 16 bytes is 128 bits, the length the CSP
 * specification asks for, and base64 renders it as 24 characters.
 */
const NONCE_BYTES = 16;

/**
 * A fresh CSP nonce for one response.
 *
 * `crypto.getRandomValues` rather than `Math.random()`: this value is what
 * separates the application's own inline scripts from an injected one, so it
 * is a security token and `typescript:S2245` applies. The Web Crypto global
 * is available in both the Edge and the Node.js middleware runtimes, so no
 * import is needed and none of `node:crypto` leaks into an edge bundle.
 */
export function createCspNonce(): string {
  const bytes = new Uint8Array(NONCE_BYTES);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

const SELF = "'self'";
const NONE = "'none'";

/**
 * The host asset photos are served from, matching the `images.remotePatterns`
 * entry in `next.config.ts` — a wildcard for the same reason given there: the
 * Supabase project URL is server-side configuration, and a policy that
 * depended on a variable CI does not hold would ship a deployment that blocks
 * its own images. CSP cannot narrow a host source by path, so the narrowing
 * `remotePatterns` does is not reproducible here.
 *
 * It is needed twice. `img-src`, because the scan page and the application
 * shell render photos straight from the public object route; and
 * `connect-src`, because the browser uploads to a signed URL on that same
 * host itself (ADR 0005 — image bytes never pass through a function), so
 * blocking it would break photo upload rather than merely a thumbnail.
 */
const SUPABASE_HOST = "https://*.supabase.co";

/** Development-only websocket scheme, for the Next.js hot-reload socket. */
const DEV_WEBSOCKET = "ws:";

/**
 * `script-src`.
 *
 * The nonce is the point of the whole exercise: Next.js streams its RSC
 * payload to the browser in inline `<script>` elements on every response, so
 * a policy without either a nonce or `'unsafe-inline'` blocks hydration.
 * Next.js reads the nonce out of the `Content-Security-Policy` *request*
 * header that the middleware sets and applies it to every script it renders,
 * which is why the middleware sets that header on the request as well as on
 * the response.
 *
 * No `'strict-dynamic'`, and that is the one deviation from the Next.js
 * documentation's example. `'strict-dynamic'` makes a browser ignore host
 * sources — `'self'` included — for anything that is not a nonced script
 * element, and `importScripts()` inside a worker is exactly that. The photo
 * pipeline compresses in a Web Worker built from a `blob:` URL which
 * `importScripts()` the vendored `browser-image-compression` build back from
 * this origin (`src/lib/photo-compression.ts`), so `'strict-dynamic'` would
 * trade a working upload path for a stricter policy. `'self'` is kept
 * instead: this application serves no user-supplied content from its own
 * origin — photos live in the Supabase bucket — so there is nothing
 * same-origin for an injected `<script src>` to point at.
 *
 * `'unsafe-eval'` in development only. The Next.js development bundler and
 * React Fast Refresh evaluate module code, and a production bundle does not.
 */
function scriptSrc(nonce: string, isDevelopment: boolean): string {
  const sources = [SELF, `'nonce-${nonce}'`];
  if (isDevelopment) {
    sources.push("'unsafe-eval'");
  }
  return `script-src ${sources.join(" ")}`;
}

/**
 * `connect-src`. `SUPABASE_HOST` for the direct browser upload; the websocket
 * scheme for the development hot-reload channel, which a production build
 * never opens.
 */
function connectSrc(isDevelopment: boolean): string {
  const sources = [SELF, SUPABASE_HOST];
  if (isDevelopment) {
    sources.push(DEV_WEBSOCKET);
  }
  return `connect-src ${sources.join(" ")}`;
}

/**
 * `style-src` allows `'unsafe-inline'`, and the acceptance criteria of issue
 * #113 allow it for styles while forbidding it for scripts. Two inline styles
 * exist and neither can carry a nonce usefully: React renders
 * `DashboardBarChart`'s bar width as a `style` attribute, which no nonce
 * applies to at all, and the label sheet's print stylesheet is a plain
 * `<style>` element (`LabelSheetStyle.tsx`). Both are built from this
 * repository's own numbers, never from a request or the database, so the
 * injection `'unsafe-inline'` would enable has no source to come from — and
 * a nonce in this directive would make the browser ignore `'unsafe-inline'`
 * and break the `style` attribute anyway.
 */
const STYLE_SRC = `style-src ${SELF} 'unsafe-inline'`;

export interface CspOptions {
  readonly nonce: string;
  /** `true` outside a production build: relaxes exactly two directives. */
  readonly isDevelopment: boolean;
}

/**
 * The full policy as one header value.
 *
 * `worker-src` needs `blob:` for the compression worker described above.
 * `img-src` needs `data:` and `blob:` because the compressor draws through a
 * canvas and object URLs, and `frame-ancestors 'none'` is the CSP half of the
 * clickjacking protection whose header half is `X-Frame-Options` below.
 * `upgrade-insecure-requests` is production-only: over plain `http://` on
 * localhost it has nothing to upgrade and only risks rewriting the
 * development websocket.
 */
export function buildContentSecurityPolicy({
  nonce,
  isDevelopment,
}: Readonly<CspOptions>): string {
  const directives = [
    `default-src ${SELF}`,
    scriptSrc(nonce, isDevelopment),
    STYLE_SRC,
    `img-src ${SELF} data: blob: ${SUPABASE_HOST}`,
    `font-src ${SELF}`,
    connectSrc(isDevelopment),
    `worker-src ${SELF} blob:`,
    `media-src ${NONE}`,
    `object-src ${NONE}`,
    `frame-src ${NONE}`,
    `frame-ancestors ${NONE}`,
    `base-uri ${SELF}`,
    `form-action ${SELF}`,
  ];
  if (!isDevelopment) {
    directives.push("upgrade-insecure-requests");
  }
  return directives.join("; ");
}

/** Header name, so the middleware and its test cannot spell it differently. */
export const CSP_HEADER_NAME = "Content-Security-Policy";

/**
 * `camera=(self)` rather than `camera=()`: the photo control is a file input
 * with `capture="environment"` (`PhotoUploadControl.tsx`), which is how a
 * phone gets the rear camera for an asset photo. Everything the product never
 * asks for is denied outright.
 */
const PERMISSIONS_POLICY = [
  "camera=(self)",
  "microphone=()",
  "geolocation=()",
  "payment=()",
  "usb=()",
  "display-capture=()",
].join(", ");

/**
 * The headers that are the same on every response.
 *
 * `Referrer-Policy` is the finding worth reading twice: the scan URL's path
 * segment *is* the QR token, so a full-URL referrer would hand a working
 * capability to any third-party host the page reaches.
 * `strict-origin-when-cross-origin` sends the origin alone off-site, which
 * leaves the token where it belongs.
 */
export const STATIC_SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: PERMISSIONS_POLICY },
] as const;
