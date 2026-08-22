import type { AssetCondition, AssetStatus } from "@/app/(app)/assets/schemas";

/**
 * The "requiring attention" rule (PRD FR-9.1): `status = in_repair` OR
 * `condition = poor` OR no photo attached. Declared once here so the
 * dashboard's count (`src/app/(app)/dashboard-queries.ts`) and the asset
 * list's `attention` filter (`src/lib/asset-list-query.ts`) can never drift
 * apart — a card that says "12" and a filtered list that shows 11 rows would
 * both be reading a rule that only existed once, twice, slightly differently.
 *
 * `photos: { none: {} }` is Prisma's relation filter for "zero related
 * rows" — it compiles to a `NOT EXISTS` against `asset_photo`, so "no photo
 * attached" is still evaluated in SQL rather than by loading photos into
 * JavaScript.
 */

export const ATTENTION_STATUS: AssetStatus = "in_repair";
export const ATTENTION_CONDITION: AssetCondition = "poor";

/**
 * A plain (mutable) array, not a readonly tuple: Prisma's generated
 * `AssetWhereInput["OR"]` is `AssetWhereInput[]`, and a readonly tuple cannot
 * be assigned to that even through the `as`-cast every `where`-builder in
 * this codebase ends with (`asset-list-query.ts`'s own `OR` is a plain
 * `.map()` array for the same reason).
 */
export interface AttentionWhereClause {
  readonly OR: Array<
    | { readonly status: AssetStatus }
    | { readonly condition: AssetCondition }
    | { readonly photos: { readonly none: Record<string, never> } }
  >;
}

export function buildAttentionWhere(): AttentionWhereClause {
  return {
    OR: [
      { status: ATTENTION_STATUS },
      { condition: ATTENTION_CONDITION },
      { photos: { none: {} } },
    ],
  };
}

/**
 * The same rule, expressed as a pure predicate over one asset's fields
 * rather than as a Prisma clause. Used only by this module's own tests, to
 * prove the SQL-facing `buildAttentionWhere` above encodes the same rule
 * FR-9.1 states in prose — a second, independent statement of the rule that
 * the query shape is checked against, not a code path either query runs.
 */
export interface AttentionCandidate {
  readonly status: AssetStatus;
  readonly condition: AssetCondition;
  readonly hasPhoto: boolean;
}

export function requiresAttention(candidate: AttentionCandidate): boolean {
  return (
    candidate.status === ATTENTION_STATUS ||
    candidate.condition === ATTENTION_CONDITION ||
    !candidate.hasPhoto
  );
}
