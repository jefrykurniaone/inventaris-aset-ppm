import { db } from "@/lib/db";

/**
 * The bulk label sheet's read (PRD FR-5.3, FR-5.4): only the three fields a
 * printed label needs. This is the narrowest possible query, not merely a
 * public-audience one — `qrToken`, `assetCode` and `name` are all PUBLIC in
 * §8.2, and nothing else is selected at all, so there is no restricted
 * column this query could leak regardless of who requested the print run.
 *
 * A soft-deleted asset is excluded rather than printed with a scan link that
 * would resolve to the withdrawn state (FR-2.5) — reprinting a label for a
 * deleted asset is never useful.
 */

export interface LabelAssetRow {
  readonly id: string;
  readonly assetCode: string;
  readonly name: string;
  readonly qrToken: string;
}

/**
 * Every requested asset that still exists and is not soft-deleted, in the
 * order `ids` was given — the order the caller's selection was made in.
 * `db.asset.findMany({ where: { id: { in } } })` does not preserve that
 * order on its own, so it is restored here rather than left to whatever
 * order Postgres happens to return.
 */
export async function listLabelAssets(
  ids: readonly string[],
): Promise<readonly LabelAssetRow[]> {
  if (ids.length === 0) {
    return [];
  }

  const rows = await db.asset.findMany({
    where: { id: { in: [...ids] }, deletedAt: null },
    select: { id: true, assetCode: true, name: true, qrToken: true },
  });

  const rowById = new Map(rows.map((row) => [row.id, row]));
  return ids.flatMap((id) => {
    const row = rowById.get(id);
    return row ? [row] : [];
  });
}
