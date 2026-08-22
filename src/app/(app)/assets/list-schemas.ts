import { z } from "zod";

import {
  ASSET_LIST_SORT_DIRECTIONS,
  ASSET_LIST_SORT_KEYS,
  DEFAULT_ASSET_LIST_PAGE_SIZE,
  DEFAULT_ASSET_LIST_SORT_DIRECTION,
  DEFAULT_ASSET_LIST_SORT_KEY,
  FIRST_ASSET_LIST_PAGE,
  MAX_ASSET_LIST_PAGE_SIZE,
  MIN_ASSET_LIST_PAGE_SIZE,
  type AssetListSortDirection,
  type AssetListSortKey,
} from "@/lib/asset-list-query";

import {
  ASSET_CONDITIONS,
  ASSET_STATUSES,
  type AssetCondition,
  type AssetStatus,
} from "./schemas";

/**
 * Validates `/assets`'s URL search params (PRD FR-2.6). A search param is an
 * HTTP entry point a visitor can hand-edit or bookmark, so every one of
 * these — every filter, the sort key, the sort direction, the page number
 * and the page size — falls back to a default rather than throwing and
 * failing the page.
 *
 * Built from plain `z.unknown().optional().transform(...)` rather than `.pipe()`
 * chains: Next.js can hand a repeated param back as `string[]` instead of
 * `string`, and every one of these transforms treats that, along with any
 * other non-string or out-of-range value, as "not given" and falls back —
 * `transform` never throws here, so there is nothing for `.catch()` to need
 * to intercept.
 */

const SEARCH_MAX_LENGTH = 200;

/** A raw search-param value, trimmed, or `undefined` for anything that is
 * not a plain non-empty string — including the `string[]` shape a repeated
 * query param produces. */
function readParam(raw: unknown): string | undefined {
  if (typeof raw !== "string") {
    return undefined;
  }
  const trimmed = raw.trim();
  return trimmed === "" ? undefined : trimmed;
}

function readInt(raw: unknown): number | undefined {
  const value = readParam(raw);
  if (value === undefined) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : undefined;
}

/** A free-form id filter: any non-empty string is accepted — a value that
 * matches no row simply returns zero results, which is not an error the
 * page needs to guard against. */
const optionalId = z
  .unknown()
  .optional()
  .transform((raw) => readParam(raw));

const searchTerm = z
  .unknown()
  .optional()
  .transform((raw) => {
    const value = readParam(raw);
    return value !== undefined && value.length <= SEARCH_MAX_LENGTH
      ? value
      : undefined;
  });

const statusFilter = z
  .unknown()
  .optional()
  .transform((raw): AssetStatus | undefined => {
    const value = readParam(raw);
    return value !== undefined &&
      (ASSET_STATUSES as readonly string[]).includes(value)
      ? (value as AssetStatus)
      : undefined;
  });

const conditionFilter = z
  .unknown()
  .optional()
  .transform((raw): AssetCondition | undefined => {
    const value = readParam(raw);
    return value !== undefined &&
      (ASSET_CONDITIONS as readonly string[]).includes(value)
      ? (value as AssetCondition)
      : undefined;
  });

const acquisitionYearFilter = z
  .unknown()
  .optional()
  .transform((raw) => readInt(raw));

/** The dashboard's "requiring attention" card links to `?attention=1`
 * (PRD FR-9.1). Any other value — including a stray `attention=0` a visitor
 * might type — reads as "not requested", the same fallback-never-throw rule
 * every other param here follows. */
const ATTENTION_QUERY_VALUE = "1";

const attentionFilter = z
  .unknown()
  .optional()
  .transform((raw): boolean => readParam(raw) === ATTENTION_QUERY_VALUE);

const sortKeyParam = z
  .unknown()
  .optional()
  .transform((raw): AssetListSortKey => {
    const value = readParam(raw);
    return value !== undefined &&
      (ASSET_LIST_SORT_KEYS as readonly string[]).includes(value)
      ? (value as AssetListSortKey)
      : DEFAULT_ASSET_LIST_SORT_KEY;
  });

const sortDirectionParam = z
  .unknown()
  .optional()
  .transform((raw): AssetListSortDirection => {
    const value = readParam(raw);
    return value !== undefined &&
      (ASSET_LIST_SORT_DIRECTIONS as readonly string[]).includes(value)
      ? (value as AssetListSortDirection)
      : DEFAULT_ASSET_LIST_SORT_DIRECTION;
  });

const pageParam = z
  .unknown()
  .optional()
  .transform((raw) => {
    const parsed = readInt(raw);
    return parsed !== undefined && parsed >= FIRST_ASSET_LIST_PAGE
      ? parsed
      : FIRST_ASSET_LIST_PAGE;
  });

const pageSizeParam = z
  .unknown()
  .optional()
  .transform((raw) => {
    const parsed = readInt(raw);
    return parsed !== undefined &&
      parsed >= MIN_ASSET_LIST_PAGE_SIZE &&
      parsed <= MAX_ASSET_LIST_PAGE_SIZE
      ? parsed
      : DEFAULT_ASSET_LIST_PAGE_SIZE;
  });

export const assetListSearchParamsSchema = z.object({
  q: searchTerm,
  categoryId: optionalId,
  buildingId: optionalId,
  roomId: optionalId,
  fundingSourceId: optionalId,
  status: statusFilter,
  condition: conditionFilter,
  acquisitionYear: acquisitionYearFilter,
  attention: attentionFilter,
  sort: sortKeyParam,
  dir: sortDirectionParam,
  page: pageParam,
  pageSize: pageSizeParam,
});

export type AssetListSearchParams = z.infer<typeof assetListSearchParamsSchema>;
