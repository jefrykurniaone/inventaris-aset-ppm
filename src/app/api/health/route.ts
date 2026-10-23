import { db } from "@/lib/db";
import { createActionErrorLogger } from "@/lib/log-error";

/**
 * `GET /api/health` — the liveness probe: it answers `200` only when the
 * database answers (PRD risk R4, issue #17).
 *
 * It began as a keep-alive for a free Supabase project, which was paused after
 * a week without API requests, and that is why it issues a real query through
 * the `src/lib/db.ts` seam instead of answering `200` on its own. The Supabase
 * project and the Vercel deployment are gone (ADR 0009), but the route stays
 * and the real query stays with it: a probe that never touched the database
 * would report a healthy application whose database was down.
 *
 * `SELECT 1` rather than a `count()`: it opens the connection, reaches
 * Postgres and returns a constant, so it proves the path without reading a row
 * or naming a table. There is nothing here for a schema change to break.
 *
 * Unauthenticated on purpose. A scheduler holds no session, this repository has
 * no `middleware.ts` to exempt the route from, and the response carries no
 * information about the data — only whether the database answered.
 */

/** No session, no personal data, no row: nothing to protect but the error text. */
const UNAVAILABLE_BODY = { status: "unavailable" } as const;
const OK_BODY = { status: "ok" } as const;

const SERVICE_UNAVAILABLE = 503;

/**
 * A cached response would defeat the endpoint. A cache answering in front of
 * the application means no request reaches the database, and the probe reports
 * success while the database is down.
 */
const NO_STORE = "no-store";

/**
 * Route handlers are uncached by default in Next.js 15, but this one must also
 * never be evaluated at build time — it opens a database connection, and CI
 * builds against a `DATABASE_URL` that points nowhere.
 */
export const dynamic = "force-dynamic";

const logHealthError = createActionErrorLogger("src/app/api/health/route.ts");

function healthResponse(
  body: typeof OK_BODY | typeof UNAVAILABLE_BODY,
  status?: number,
): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": NO_STORE },
  });
}

export async function GET(): Promise<Response> {
  try {
    await db.$queryRaw`SELECT 1`;
    return healthResponse(OK_BODY);
  } catch (error) {
    // The caller is a scheduler, not a person, so there is no localised string
    // to return and no user-facing surface to leak into. The reason stays in
    // the server log; the body says only that the probe failed.
    logHealthError("GET", null, error);
    return healthResponse(UNAVAILABLE_BODY, SERVICE_UNAVAILABLE);
  }
}
