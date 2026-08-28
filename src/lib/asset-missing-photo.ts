/**
 * The "missing photo" rule (spec #138, ticket #140): a live asset with zero
 * related photos. Declared once here so the dashboard's count
 * (`src/app/(app)/dashboard-queries.ts`), the asset list's `noPhoto` filter
 * and the CSV export (`src/lib/asset-list-query.ts`) can never drift apart —
 * the same single-declaration pattern `asset-attention.ts` uses for the
 * requires-attention rule.
 *
 * `photos: { none: {} }` is Prisma's relation filter for "zero related
 * rows" — it compiles to a `NOT EXISTS` against `asset_photo`, so "no photo
 * attached" is evaluated in SQL rather than by loading photos into
 * JavaScript.
 */

export interface MissingPhotoWhereClause {
  readonly photos: { readonly none: Record<string, never> };
}

export function buildMissingPhotoWhere(): MissingPhotoWhereClause {
  return { photos: { none: {} } };
}

/**
 * The same rule, expressed as a pure predicate over one asset's fields
 * rather than as a Prisma clause. Used only by this module's own tests, to
 * prove the SQL-facing `buildMissingPhotoWhere` above encodes the same rule
 * the spec states in prose — a second, independent statement of the rule
 * that the query shape is checked against, not a code path either query
 * runs.
 */
export interface MissingPhotoCandidate {
  readonly hasPhoto: boolean;
}

export function isMissingPhoto(candidate: MissingPhotoCandidate): boolean {
  return !candidate.hasPhoto;
}
