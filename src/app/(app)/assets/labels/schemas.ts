import { z } from "zod";

import { isValidLabelOffset, MAX_LABEL_OFFSET } from "@/lib/label-pagination";

import { assetIdSchema } from "../schemas";

/**
 * Validates `/assets/labels`'s URL search params (PRD FR-5.4, FR-5.5): the
 * asset list's selection (#8) and the asset detail page's single-asset
 * reprint link both arrive as `?ids=<comma-separated ids>`, with an optional
 * `?offset=` for a partly used sheet. Same defensive shape as
 * `../list-schemas.ts` — every value here is bookmark- or hand-edit-
 * controlled, so a malformed one falls back rather than throwing and failing
 * the page.
 */

export { MAX_LABEL_OFFSET };

/** Generous enough for the whole seeded register (60 assets) several times
 * over, small enough to keep the query and the print run bounded rather than
 * unlimited. */
export const MAX_LABEL_IDS = 500;

const DEFAULT_OFFSET = 0;

function readParam(raw: unknown): string | undefined {
  if (typeof raw !== "string") {
    return undefined;
  }
  const trimmed = raw.trim();
  return trimmed === "" ? undefined : trimmed;
}

const idsParam = z
  .unknown()
  .optional()
  .transform((raw): readonly string[] => {
    const value = readParam(raw);
    if (value === undefined) {
      return [];
    }
    const ids = value
      .split(",")
      .map((id) => id.trim())
      .filter((id) => assetIdSchema.safeParse(id).success);
    return ids.slice(0, MAX_LABEL_IDS);
  });

const offsetParam = z
  .unknown()
  .optional()
  .transform((raw): number => {
    const value = readParam(raw);
    if (value === undefined) {
      return DEFAULT_OFFSET;
    }
    const parsed = Number(value);
    return isValidLabelOffset(parsed) ? parsed : DEFAULT_OFFSET;
  });

export const labelsSearchParamsSchema = z.object({
  ids: idsParam,
  offset: offsetParam,
});

export type LabelsSearchParams = z.infer<typeof labelsSearchParamsSchema>;
