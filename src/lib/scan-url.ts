const DEFAULT_APP_URL = "http://localhost:3000";

/** Strips one or more trailing slashes so joining a path never doubles one. */
function stripTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, "");
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
  return `${base}/a/${qrToken}`;
}
