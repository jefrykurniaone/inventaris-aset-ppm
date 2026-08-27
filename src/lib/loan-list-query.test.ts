import { describe, expect, it } from "vitest";

import {
  buildLoanListOrderBy,
  buildLoanListPageWindow,
  buildLoanListWhere,
  buildOverdueLoanWhere,
  DEFAULT_LOAN_LIST_PAGE_SIZE,
  DEFAULT_LOAN_LIST_SORT_DIRECTION,
  DEFAULT_LOAN_LIST_SORT_KEY,
  FIRST_LOAN_LIST_PAGE,
  totalLoanListPageCount,
} from "./loan-list-query";
import type { LoanState } from "./loan-transitions";

const NOW = new Date("2026-08-22T09:00:00.000Z");

describe("buildOverdueLoanWhere", () => {
  it("asks for open loans whose due date has passed", () => {
    expect(buildOverdueLoanWhere(NOW)).toEqual({
      returnedAt: null,
      dueAt: { lt: NOW },
    });
  });
});

describe("buildLoanListWhere", () => {
  it("matches every loan when no filter is given", () => {
    expect(buildLoanListWhere({}, NOW)).toEqual({});
  });

  it.each<{ state: LoanState; expected: Record<string, unknown> }>([
    { state: "active", expected: { returnedAt: null, dueAt: { gte: NOW } } },
    { state: "overdue", expected: { returnedAt: null, dueAt: { lt: NOW } } },
    { state: "returned", expected: { returnedAt: { not: null } } },
  ])("translates the $state filter", ({ state, expected }) => {
    expect(buildLoanListWhere({ state }, NOW)).toEqual(expected);
  });

  it("keeps the active and overdue filters disjoint", () => {
    const active = buildLoanListWhere({ state: "active" }, NOW);
    const overdue = buildLoanListWhere({ state: "overdue" }, NOW);
    expect(active).not.toEqual(overdue);
  });

  it("searches the borrower name and the asset name and code", () => {
    expect(buildLoanListWhere({ search: "budi" }, NOW)).toEqual({
      OR: [
        { borrowerName: { contains: "budi", mode: "insensitive" } },
        { asset: { name: { contains: "budi", mode: "insensitive" } } },
        { asset: { assetCode: { contains: "budi", mode: "insensitive" } } },
      ],
    });
  });

  it("never searches the borrower email or unit", () => {
    const where = JSON.stringify(buildLoanListWhere({ search: "x" }, NOW));
    expect(where).not.toContain("borrowerEmail");
    expect(where).not.toContain("borrowerUnit");
  });

  it("trims the search term", () => {
    const where = buildLoanListWhere({ search: "  budi  " }, NOW);
    expect(JSON.stringify(where)).toContain('"contains":"budi"');
  });

  it("drops a search term that is only whitespace", () => {
    expect(buildLoanListWhere({ search: "   " }, NOW)).toEqual({});
  });

  it("combines a state filter and a search term with AND", () => {
    const where = buildLoanListWhere(
      { state: "overdue", search: "mikroskop" },
      NOW,
    );
    expect(where).toMatchObject({ returnedAt: null, dueAt: { lt: NOW } });
    expect(Array.isArray((where as { OR?: unknown[] }).OR)).toBe(true);
  });
});

describe("buildLoanListOrderBy", () => {
  it("sorts by the default due date, oldest first, with a stable tie-break", () => {
    expect(
      buildLoanListOrderBy(
        DEFAULT_LOAN_LIST_SORT_KEY,
        DEFAULT_LOAN_LIST_SORT_DIRECTION,
      ),
    ).toEqual([{ dueAt: "asc" }, { id: "asc" }]);
  });

  it.each([
    { sortKey: "checkedOutAt" as const, expected: { checkedOutAt: "desc" } },
    { sortKey: "returnedAt" as const, expected: { returnedAt: "desc" } },
    { sortKey: "dueAt" as const, expected: { dueAt: "desc" } },
  ])("orders by $sortKey on its own column", ({ sortKey, expected }) => {
    expect(buildLoanListOrderBy(sortKey, "desc")).toEqual([
      expected,
      { id: "desc" },
    ]);
  });

  it("orders by asset code through the relation, not a loan column", () => {
    expect(buildLoanListOrderBy("assetCode", "asc")).toEqual([
      { asset: { assetCode: "asc" } },
      { id: "asc" },
    ]);
  });

  it("keeps due-soonest-first and a ten-row page as the list's defaults", () => {
    expect(DEFAULT_LOAN_LIST_SORT_KEY).toBe("dueAt");
    expect(DEFAULT_LOAN_LIST_SORT_DIRECTION).toBe("asc");
    expect(DEFAULT_LOAN_LIST_PAGE_SIZE).toBe(10);
  });
});

describe("buildLoanListPageWindow", () => {
  it.each([
    { page: 1, expected: 0 },
    { page: 2, expected: DEFAULT_LOAN_LIST_PAGE_SIZE },
    { page: 5, expected: 4 * DEFAULT_LOAN_LIST_PAGE_SIZE },
    { page: 0, expected: 0 },
    { page: -3, expected: 0 },
  ])("skips $expected rows for page $page", ({ page, expected }) => {
    const window = buildLoanListPageWindow(page, DEFAULT_LOAN_LIST_PAGE_SIZE);
    expect(window).toEqual({
      skip: expected,
      take: DEFAULT_LOAN_LIST_PAGE_SIZE,
    });
  });
});

describe("totalLoanListPageCount", () => {
  it.each([
    { totalCount: 0, expected: FIRST_LOAN_LIST_PAGE },
    { totalCount: 1, expected: 1 },
    { totalCount: 10, expected: 1 },
    { totalCount: 11, expected: 2 },
    { totalCount: 40, expected: 4 },
  ])(
    "spans $expected pages for $totalCount rows",
    ({ totalCount, expected }) => {
      expect(
        totalLoanListPageCount(totalCount, DEFAULT_LOAN_LIST_PAGE_SIZE),
      ).toBe(expected);
    },
  );
});
