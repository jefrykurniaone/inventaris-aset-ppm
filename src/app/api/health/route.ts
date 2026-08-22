import { db } from "@/lib/db";
import { createActionErrorLogger } from "@/lib/log-error";

/**
 * `GET /api/health` — the liveness probe that keeps the Supabase project awake
 * (PRD risk R4, issue #17).
 *
 * **The thing that pauses is the Supabase project, not the Vercel deployment.**
 * A free Supabase project receiving no API requests for one week is paused
 * automatically, so an endpoint that answered `200` out of Vercel without
 * touching the database would satisfy the scheduler and let the database sleep
 * anyway. This one issues a real query through the `src/lib/db.ts` seam, which
 * is the whole point of its existence: the round trip *is* the traffic.
 *
 * `SELECT 1` rather than a `count()`: it opens the connection, crosses
 * Supavisor, reaches Postgres and returns a constant, so it proves the path
 * without reading a row or naming a table. There is nothing here for a schema
 * change to break.
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
 * A cached response would defeat the endpoint. Vercel's CDN answering from the
 * edge means no request reaches Supabase, and the project pauses while the
 * schedule reports success every day.
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
