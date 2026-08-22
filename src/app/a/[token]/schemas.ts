import { z } from "zod";

import { isQrTokenShape } from "@/lib/qr-token";

/**
 * The two pieces of untrusted input `/a/[token]` accepts. It is an
 * unauthenticated HTTP entry point, so both are validated server-side before
 * anything reads the database (`CLAUDE.md`, Security).
 */

/** The path segment. A shape check only — whether the token is real is a
 * question only the database answers, and a miss is an ordinary 404. */
const scanTokenSchema = z.string().refine(isQrTokenShape);

export function parseScanToken(raw: unknown): string | null {
  const result = scanTokenSchema.safeParse(raw);
  return result.success ? result.data : null;
}

/**
 * A photo id can only ever come back as one of the ids this page just fetched,
 * so the ceiling below is a sanity bound rather than the check that matters:
 * `resolveSelectedPhoto` matches the value against the asset's own gallery and
 * falls back to the primary photo, which means an id belonging to a different
 * asset selects nothing and reveals nothing.
 */
const PHOTO_PARAM_MAX_LENGTH = 64;

const selectedPhotoSchema = z
  .unknown()
  .optional()
  .transform((raw) => {
    if (typeof raw !== "string") {
      return null;
    }
    const isPlausible = raw.length > 0 && raw.length <= PHOTO_PARAM_MAX_LENGTH;
    return isPlausible ? raw : null;
  });

/** The name of the gallery's search param. Exported so the links that build it
 * and the page that reads it cannot drift. */
export const SELECTED_PHOTO_PARAM = "photo";

export function parseSelectedPhotoId(raw: unknown): string | null {
  return selectedPhotoSchema.parse(raw);
}
