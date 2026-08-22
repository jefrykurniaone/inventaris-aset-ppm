const DEFAULT_APP_URL = "http://localhost:3000";

const SLASH = "/";

/**
 * Strips one or more trailing slashes so joining a path never doubles one.
 *
 * A loop, not `value.replace(/\/+$/, "")`: an unbounded quantifier abutting
 * `$` is exactly the super-linear-backtracking shape SonarQube
 * `typescript:S8786` flags, and this repository has already been bitten by
 * that shape three times (#37, #50). `NEXT_PUBLIC_APP_URL` is
 * operator-controlled rather than user input, so it was never exploitable
 * here — but the standard does not carve out "probably safe input", and a
 * plain loop is no less clear than the regex was.
 */
function stripTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value[end - 1] === SLASH) {
    end -= 1;
  }
  return value.slice(0, end);
}

const SCAN_PATH_PREFIX = "/a";

/**
 * The public scan route as a site-relative path, for links the browser is
 * already on the right origin for — the scan page's own photo-selection links
 * (#11).
 *
 * It lives here, and `buildScanUrl` is written in terms of it, so the printed
 * label and the in-page link cannot come to disagree about where `/a/<token>`
 * is. A token is `nanoid`'s URL alphabet by construction
 * (`src/lib/qr-token.ts`), so no escaping is needed in the segment.
 */
export function buildScanPath(qrToken: string): string {
  return `${SCAN_PATH_PREFIX}/${qrToken}`;
}

/**
 * The absolute public scan URL a printed QR code encodes and the asset
 * detail page shows and links to (PRD FR-5.1: `${NEXT_PUBLIC_APP_URL}/a/<qrToken>`).
 *
 * `NEXT_PUBLIC_APP_URL` is read here rather than cached at module load, the
 * same reasoning `src/lib/storage.ts` gives for its own env reads: a script
 * or test that sets the variable after this module is imported still gets
 * the right base. Falling back to `localhost:3000` rather than throwing
 * keeps local development working with the `.env.example` default; a
 * missing variable in a real deployment is caught by the printed label
 * looking wrong long before a user does, and issue #21's "no label may be
 * printed for real use until `NEXT_PUBLIC_APP_URL` is final" is a process
 * rule, not something this function can enforce.
 */
export function buildScanUrl(qrToken: string): string {
  const base = stripTrailingSlashes(
    process.env.NEXT_PUBLIC_APP_URL ?? DEFAULT_APP_URL,
  );
  return `${base}${buildScanPath(qrToken)}`;
}
