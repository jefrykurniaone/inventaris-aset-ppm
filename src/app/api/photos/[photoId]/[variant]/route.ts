import { z } from "zod";

import { createActionErrorLogger } from "@/lib/log-error";
import { isPhotoVariant } from "@/lib/photo-address";
import { getPhotoStorage } from "@/lib/storage";

/**
 * `GET /api/photos/<photoId>/<variant>` — one stored derivative of one photo
 * (ADR 0009, issue #163). `variant` is `full` or `thumb`
 * (`src/lib/photo-address.ts` builds these addresses).
 *
 * Public, and it reads no session. It answers 404 — for everyone, staff
 * included — when the photo does not exist, when its asset is withdrawn, and
 * when the variant or the id is malformed, and the three are
 * indistinguishable. No page shows a withdrawn asset's photos to anyone, and
 * the withdrawn half of that rule is enforced by `readPhotoVariant` in the
 * query itself, not here. It sits under `/api`, which the request middleware
 * does not process.
 *
 * **This origin now serves bytes that users supplied**, so the headers below
 * are the security boundary and must not be weakened:
 *
 * - `Content-Type` is the type the upload route found in the bytes, never one
 *   a browser declared, and `X-Content-Type-Options: nosniff` stops the
 *   browser second-guessing it — a polyglot cannot be promoted to HTML or
 *   script.
 * - `Content-Security-Policy: default-src 'none'; sandbox` means that even a
 *   response somehow rendered as a document runs nothing, loads nothing, and
 *   gets an opaque origin with no access to this application's cookies or
 *   storage.
 * - `Cache-Control: public, max-age=31536000, immutable`, because a photo
 *   id's bytes never change — a replaced photo is a new row with a new id. A
 *   browser that cached a photo before its asset was withdrawn keeps that
 *   copy; ADR 0009 accepts that.
 */

const NOT_FOUND = 404;
const INTERNAL_ERROR = 500;
const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";
const UNCACHED = "no-store";
const SANDBOX_POLICY = "default-src 'none'; sandbox";

/**
 * Read on every request and never evaluated at build time: the bytes live in
 * the database, a withdrawal or a delete must take effect on the next request,
 * and CI builds against a database that is not there.
 */
export const dynamic = "force-dynamic";

const photoIdSchema = z.uuid();

const logServeError = createActionErrorLogger(
  "src/app/api/photos/[photoId]/[variant]/route.ts",
);

interface RouteContext {
  readonly params: Promise<{
    readonly photoId: string;
    readonly variant: string;
  }>;
}

/** An empty answer, marked `no-store` so that only a photo's bytes are ever
 * cached, never a refusal. */
function emptyResponse(status: number): Response {
  return new Response(null, {
    status,
    headers: {
      "Cache-Control": UNCACHED,
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function GET(
  _request: Request,
  context: RouteContext,
): Promise<Response> {
  const { photoId, variant } = await context.params;
  if (!isPhotoVariant(variant) || !photoIdSchema.safeParse(photoId).success) {
    return emptyResponse(NOT_FOUND);
  }

  try {
    const stored = await getPhotoStorage().readPhotoVariant(photoId, variant);
    if (!stored) {
      return emptyResponse(NOT_FOUND);
    }
    return new Response(stored.bytes, {
      headers: {
        "Content-Type": stored.contentType,
        "Content-Length": String(stored.bytes.length),
        "Cache-Control": IMMUTABLE_CACHE_CONTROL,
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": SANDBOX_POLICY,
      },
    });
  } catch (error) {
    // The body says nothing about why: the caller is an `<img>`, and the
    // reason belongs in the server log, not in a response anyone can fetch.
    logServeError("GET", { photoId, variant }, error);
    return emptyResponse(INTERNAL_ERROR);
  }
}
