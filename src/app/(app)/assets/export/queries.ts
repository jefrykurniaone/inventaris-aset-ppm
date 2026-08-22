import {
  ASSET_EXPORT_CHUNK_SIZE,
  type AssetExportSource,
} from "@/lib/asset-export";
import {
  ADMIN_ASSET_EXPORT_SELECT,
  STAFF_ASSET_EXPORT_SELECT,
} from "@/lib/asset-export-columns";
import {
  buildAssetListOrderBy,
  buildAssetListWhere,
  type AssetListFilters,
  type AssetListSortDirection,
  type AssetListSortKey,
  type AssetListWhere,
} from "@/lib/asset-list-query";
import { db } from "@/lib/db";

/**
 * The export's reads (issue #14): the same filters and the same sort as the
 * list, over the whole matching set instead of one page.
 *
 * Two properties this file exists to hold:
 *
 * - **The role split happens at the query.** `fetchAdminChunk` and
 *   `fetchStaffChunk` are two functions with two literal `select` objects, not
 *   one function with a conditional column list, so a staff export never names
 *   `purchasePrice`, `fundingSource`, `procurementDocNo`, `vendor`,
 *   `warrantyUntil`, `custodianName` or `custodianEmail` in the SQL it sends.
 * - **The register is read in chunks.** A single `findMany` over a filtered
 *   register would materialise every matching row as a Prisma object before
 *   the first byte of the download exists. Instead the query pages forward on
 *   the primary key, `ASSET_EXPORT_CHUNK_SIZE` rows at a time, and the
 *   generator hands each chunk straight to the workbook writer.
 */

/**
 * `page` and `pageSize` are deliberately absent from this input. An export
 * carries the *filters and the sort* of the list the user is looking at, and
 * the whole matching set — exporting only the page on screen would be a
 * surprise, and is not what the ticket asks for. The route drops both params
 * when it builds this.
 */
export interface AssetExportQueryInput extends AssetListFilters {
  readonly sortKey: AssetListSortKey;
  readonly sortDirection: AssetListSortDirection;
}

export async function countAssetExportRows(
  query: AssetExportQueryInput,
): Promise<number> {
  return db.asset.count({ where: buildAssetListWhere(query) });
}

/** The primary key breaks ties. The list's sort keys — `name` in particular —
 * are not unique, and a cursor over a non-total ordering silently skips and
 * repeats rows at the chunk boundaries. */
const CURSOR_TIEBREAK_DIRECTION = "asc" as const;

function buildExportOrderBy(query: AssetExportQueryInput) {
  return [
    buildAssetListOrderBy(query.sortKey, query.sortDirection),
    { id: CURSOR_TIEBREAK_DIRECTION },
  ];
}

interface ChunkWindow {
  readonly where: AssetListWhere;
  readonly orderBy: ReturnType<typeof buildExportOrderBy>;
  readonly cursor: { readonly id: string } | undefined;
  readonly skip: number;
}

/** Includes every restricted column, and is reachable only from the `admin`
 * branch of `iterateAssetExportChunks`. */
async function fetchAdminChunk(
  window: ChunkWindow,
): Promise<readonly AssetExportSource[]> {
  return db.asset.findMany({
    ...window,
    take: ASSET_EXPORT_CHUNK_SIZE,
    select: ADMIN_ASSET_EXPORT_SELECT,
  });
}

/** Names no restricted column at all — see `asset-export-columns.ts`. */
async function fetchStaffChunk(
  window: ChunkWindow,
): Promise<readonly AssetExportSource[]> {
  return db.asset.findMany({
    ...window,
    take: ASSET_EXPORT_CHUNK_SIZE,
    select: STAFF_ASSET_EXPORT_SELECT,
  });
}

/** The id of the last row of a chunk, which becomes the next chunk's cursor.
 * Reading `id` is why both selects carry it; no column renders it. */
function lastIdOf(chunk: readonly AssetExportSource[]): string | undefined {
  return chunk.at(-1)?.id;
}

/**
 * Every matching asset, in sort order, one chunk per database round trip.
 * Ends when a chunk comes back short — the register may be written to while
 * an export runs, and "fewer rows than asked for" is the only end condition
 * that stays correct when it is.
 */
export async function* iterateAssetExportChunks(
  query: AssetExportQueryInput,
  isAdmin: boolean,
): AsyncGenerator<readonly AssetExportSource[]> {
  const where = buildAssetListWhere(query);
  const orderBy = buildExportOrderBy(query);
  const fetchChunk = isAdmin ? fetchAdminChunk : fetchStaffChunk;

  let cursorId: string | undefined;
  let hasMore = true;
  while (hasMore) {
    const chunk = await fetchChunk({
      where,
      orderBy,
      cursor: cursorId === undefined ? undefined : { id: cursorId },
      skip: cursorId === undefined ? 0 : 1,
    });
    if (chunk.length > 0) {
      yield chunk;
    }
    cursorId = lastIdOf(chunk);
    hasMore =
      chunk.length === ASSET_EXPORT_CHUNK_SIZE && cursorId !== undefined;
  }
}
