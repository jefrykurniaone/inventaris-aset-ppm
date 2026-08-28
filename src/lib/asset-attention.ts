import type { AssetCondition, AssetStatus } from "@/app/(app)/assets/schemas";

/**
 * The "requiring attention" rule (issue #139): `status IN (in_repair, lost)`
 * OR `condition = poor`, over live (non-deleted) assets. Declared once here
 * so the dashboard's count (`src/app/(app)/dashboard-queries.ts`) and the
 * asset list's `attention` filter (`src/lib/asset-list-query.ts`) can never
 * drift apart — a card that says "12" and a filtered list that shows 11 rows
 * would both be reading a rule that only existed once, twice, slightly
 * differently.
 */

export const ATTENTION_STATUSES: readonly AssetStatus[] = ["in_repair", "lost"];
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
    | { readonly status: { readonly in: readonly AssetStatus[] } }
    | { readonly condition: AssetCondition }
  >;
}

export function buildAttentionWhere(): AttentionWhereClause {
  return {
    OR: [
      { status: { in: ATTENTION_STATUSES } },
      { condition: ATTENTION_CONDITION },
    ],
  };
}

/**
 * The same rule, expressed as a pure predicate over one asset's fields
 * rather than as a Prisma clause. Used only by this module's own tests, to
 * prove the SQL-facing `buildAttentionWhere` above encodes the same rule
 * issue #139 states in prose — a second, independent statement of the rule
 * that the query shape is checked against, not a code path either query
 * runs.
 */
export interface AttentionCandidate {
  readonly status: AssetStatus;
  readonly condition: AssetCondition;
}

export function requiresAttention(candidate: AttentionCandidate): boolean {
  return (
    ATTENTION_STATUSES.includes(candidate.status) ||
    candidate.condition === ATTENTION_CONDITION
  );
}
