import { z } from "zod";

import {
  DEFAULT_LOAN_LIST_PAGE_SIZE,
  FIRST_LOAN_LIST_PAGE,
  MAX_LOAN_LIST_PAGE_SIZE,
  MIN_LOAN_LIST_PAGE_SIZE,
} from "@/lib/loan-list-query";
import { LOAN_STATES, type LoanState } from "@/lib/loan-transitions";

/**
 * Validates `/loans`'s URL search params (PRD FR-6). A search param is an HTTP
 * entry point a visitor can hand-edit or bookmark, so every one of these falls
 * back to a default rather than throwing and failing the page — the same
 * fallback-not-throw contract `../assets/list-schemas.ts` establishes, built
 * the same way, out of `z.unknown().optional().transform(...)` so that the
 * `string[]` shape Next.js hands back for a repeated param reads as "not
 * given" instead of blowing up.
 *
 * `q` is a search box a signed-in user typed into, and it lands in the URL like
 * any other search term. That is the one place a borrower's name may appear in
 * a URL, and only because the user put it there: nothing this application
 * *generates* — no link, no redirect, no row id — ever carries borrower data.
 * The state filter links do not, and neither does the pager.
 */

const SEARCH_MAX_LENGTH = 200;

/** A raw search-param value, trimmed, or `undefined` for anything that is not
 * a plain non-empty string. */
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

const searchTerm = z
  .unknown()
  .optional()
  .transform((raw) => {
    const value = readParam(raw);
    return value !== undefined && value.length <= SEARCH_MAX_LENGTH
      ? value
      : undefined;
  });

const stateFilter = z
  .unknown()
  .optional()
  .transform((raw): LoanState | undefined => {
    const value = readParam(raw);
    return value !== undefined &&
      (LOAN_STATES as readonly string[]).includes(value)
      ? (value as LoanState)
      : undefined;
  });

const pageParam = z
  .unknown()
  .optional()
  .transform((raw) => {
    const parsed = readInt(raw);
    return parsed !== undefined && parsed >= FIRST_LOAN_LIST_PAGE
      ? parsed
      : FIRST_LOAN_LIST_PAGE;
  });

const pageSizeParam = z
  .unknown()
  .optional()
  .transform((raw) => {
    const parsed = readInt(raw);
    return parsed !== undefined &&
      parsed >= MIN_LOAN_LIST_PAGE_SIZE &&
      parsed <= MAX_LOAN_LIST_PAGE_SIZE
      ? parsed
      : DEFAULT_LOAN_LIST_PAGE_SIZE;
  });

export const loanListSearchParamsSchema = z.object({
  q: searchTerm,
  state: stateFilter,
  page: pageParam,
  pageSize: pageSizeParam,
});

export type LoanListSearchParams = z.infer<typeof loanListSearchParamsSchema>;

/** The query string for one page of the current view, with every other param
 * preserved. Built here rather than in the pager so the one function that
 * writes a loans-list URL is next to the one that reads it — and so it is
 * plain to see that nothing but the user's own search term ever goes in. */
export function withLoanListPage(
  params: LoanListSearchParams,
  page: number,
): string {
  const search = new URLSearchParams();
  if (params.q) {
    search.set("q", params.q);
  }
  if (params.state) {
    search.set("state", params.state);
  }
  if (params.pageSize !== DEFAULT_LOAN_LIST_PAGE_SIZE) {
    search.set("pageSize", String(params.pageSize));
  }
  search.set("page", String(page));
  return search.toString();
}
