/**
 * The vocabulary every list table in this application shares (issue #87):
 * sort direction, the page-size preset scale, the whitelist-and-fall-back
 * reading of a URL search param, and the two arithmetic helpers a pager
 * needs.
 *
 * It exists because seven tables — assets, loans, users and the four
 * master-data lists — had to grow the same three behaviours at once, and
 * seven copies of "is this page size inside the bounds" is seven places for
 * the bounds to drift apart. Every function here is pure: no database, no
 * `next/headers`, no `next-intl`, so the acceptance criterion the ticket
 * names ("unknown or invalid sort and page-size URL parameters fall back to
 * defaults server-side; page size is clamped to the preset bounds") is
 * checked directly in `table-sort.test.ts` rather than inferred from a
 * rendered table.
 *
 * A search param is an HTTP entry point a visitor can hand-edit or bookmark,
 * so nothing here ever throws: every reader falls back to a default instead,
 * which is also what makes a repeated param — the `string[]` shape Next.js
 * hands back — read as "not given" rather than fail the page.
 */

export const SORT_DIRECTIONS = ["asc", "desc"] as const;

export type SortDirection = (typeof SORT_DIRECTIONS)[number];

export const FIRST_TABLE_PAGE = 1;

/** The preset scale kept from the asset list: 10 / 20 / 50 / 100. The default
 * is the smallest of them on every table, so a first visit is a short page
 * rather than a hundred rows nobody asked for. */
export const MIN_TABLE_PAGE_SIZE = 10;
const SMALL_TABLE_PAGE_SIZE = 20;
const LARGE_TABLE_PAGE_SIZE = 50;
export const MAX_TABLE_PAGE_SIZE = 100;
export const DEFAULT_TABLE_PAGE_SIZE = MIN_TABLE_PAGE_SIZE;

export const TABLE_PAGE_SIZE_OPTIONS = [
  MIN_TABLE_PAGE_SIZE,
  SMALL_TABLE_PAGE_SIZE,
  LARGE_TABLE_PAGE_SIZE,
  MAX_TABLE_PAGE_SIZE,
] as const;

/** A raw search-param value, trimmed, or `undefined` for anything that is not
 * a plain non-empty string — including the `string[]` shape a repeated query
 * param produces. */
export function readParamString(raw: unknown): string | undefined {
  if (typeof raw !== "string") {
    return undefined;
  }
  const trimmed = raw.trim();
  return trimmed === "" ? undefined : trimmed;
}

/** The same, as an integer. A fractional or non-numeric value is `undefined`,
 * never `NaN`, so a caller only has one "absent" case to handle. */
export function readParamInt(raw: unknown): number | undefined {
  const value = readParamString(raw);
  if (value === undefined) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : undefined;
}

/**
 * A sort key, whitelist-validated against the keys the caller actually
 * supports. Anything else — a column that was removed, a column the table
 * never had, an attempt at an injected order-by fragment — reads as the
 * default. This is the only way a sort key reaches a Prisma `orderBy` in this
 * codebase.
 */
export function readSortKey<Key extends string>(
  raw: unknown,
  allowedKeys: readonly Key[],
  fallback: Key,
): Key {
  const value = readParamString(raw);
  return value !== undefined &&
    (allowedKeys as readonly string[]).includes(value)
    ? (value as Key)
    : fallback;
}

export function readSortDirection(
  raw: unknown,
  fallback: SortDirection,
): SortDirection {
  return readSortKey(raw, SORT_DIRECTIONS, fallback);
}

/** A one-based page number. Zero, a negative number and a fraction all read
 * as the first page. */
export function readPageParam(raw: unknown): number {
  const parsed = readParamInt(raw);
  return parsed !== undefined && parsed >= FIRST_TABLE_PAGE
    ? parsed
    : FIRST_TABLE_PAGE;
}

/** A page size, clamped to the preset bounds. Out of range reads as the
 * default rather than as the nearest bound: a hand-edited `pageSize=100000`
 * is a mistake, and answering it with the largest allowed page is still
 * answering a question nobody asked. */
export function readPageSizeParam(raw: unknown): number {
  const parsed = readParamInt(raw);
  return parsed !== undefined &&
    parsed >= MIN_TABLE_PAGE_SIZE &&
    parsed <= MAX_TABLE_PAGE_SIZE
    ? parsed
    : DEFAULT_TABLE_PAGE_SIZE;
}

/**
 * Where a click on a column header should take the sort direction: the
 * column's own natural first direction when it is not the one being sorted
 * on, and the opposite of the current direction when it is.
 *
 * "Natural first direction" differs per column on purpose — a name reads
 * A-to-Z first, a date reads newest-first first — which is why it is the
 * column's property and not a constant.
 */
export function nextSortDirection(
  isActive: boolean,
  currentDirection: SortDirection,
  initialDirection: SortDirection,
): SortDirection {
  if (!isActive) {
    return initialDirection;
  }
  return currentDirection === "asc" ? "desc" : "asc";
}

export type AriaSort = "ascending" | "descending" | "none";

const ARIA_SORT_BY_DIRECTION: Readonly<Record<SortDirection, AriaSort>> = {
  asc: "ascending",
  desc: "descending",
};

/** The `aria-sort` value for one header cell — the W3C sortable-table
 * pattern: every sortable `<th>` carries the attribute, and only the column
 * actually being sorted on carries a direction. */
export function ariaSortValue(
  isActive: boolean,
  direction: SortDirection,
): AriaSort {
  return isActive ? ARIA_SORT_BY_DIRECTION[direction] : "none";
}

export interface TablePageWindow {
  readonly skip: number;
  readonly take: number;
}

/** Zero-based `skip`/`take` from a one-based page number. A page below 1 is
 * treated as page 1 rather than producing a negative `skip` — the parsers
 * above already clamp it, and this stays correct without trusting that. */
export function buildTablePageWindow(
  page: number,
  pageSize: number,
): TablePageWindow {
  const safePage = page < FIRST_TABLE_PAGE ? FIRST_TABLE_PAGE : page;
  return { skip: (safePage - 1) * pageSize, take: pageSize };
}

/** How many pages a result set spans. Zero rows is one empty page, not zero
 * pages, so a pager can always render "page 1 of N". */
export function countTablePages(totalCount: number, pageSize: number): number {
  if (totalCount <= 0) {
    return FIRST_TABLE_PAGE;
  }
  return Math.ceil(totalCount / pageSize);
}

export interface TableViewState {
  readonly sort: string;
  readonly dir: SortDirection;
  readonly page: number;
  readonly pageSize: number;
}

export interface TableViewDefaults {
  readonly sort: string;
  readonly dir: SortDirection;
}

/**
 * Writes the four view params onto an existing query string, omitting every
 * one that already equals its default — so a plain first visit stays a plain
 * link rather than growing every default into the address bar, and a shared
 * URL carries exactly the deviations that make the view what it is.
 */
export function appendTableViewParams(
  params: URLSearchParams,
  state: TableViewState,
  defaults: TableViewDefaults,
): URLSearchParams {
  if (state.sort !== defaults.sort) {
    params.set("sort", state.sort);
  }
  if (state.dir !== defaults.dir) {
    params.set("dir", state.dir);
  }
  if (state.page !== FIRST_TABLE_PAGE) {
    params.set("page", String(state.page));
  }
  if (state.pageSize !== DEFAULT_TABLE_PAGE_SIZE) {
    params.set("pageSize", String(state.pageSize));
  }
  return params;
}
