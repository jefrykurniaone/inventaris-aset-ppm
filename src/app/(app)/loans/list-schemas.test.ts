import { describe, expect, it } from "vitest";

import {
  DEFAULT_LOAN_LIST_PAGE_SIZE,
  DEFAULT_LOAN_LIST_SORT_DIRECTION,
  DEFAULT_LOAN_LIST_SORT_KEY,
  FIRST_LOAN_LIST_PAGE,
  MAX_LOAN_LIST_PAGE_SIZE,
  MIN_LOAN_LIST_PAGE_SIZE,
} from "@/lib/loan-list-query";

import {
  buildLoanListParamsWithoutPageSize,
  buildLoanListViewParams,
  loanListSearchParamsSchema,
  withLoanListPage,
  withLoanListSort,
} from "./list-schemas";

function parse(raw: Record<string, unknown>) {
  return loanListSearchParamsSchema.parse(raw);
}

describe("loanListSearchParamsSchema", () => {
  it("defaults every param when nothing is given", () => {
    expect(parse({})).toEqual({
      q: undefined,
      state: undefined,
      sort: DEFAULT_LOAN_LIST_SORT_KEY,
      dir: DEFAULT_LOAN_LIST_SORT_DIRECTION,
      page: FIRST_LOAN_LIST_PAGE,
      pageSize: DEFAULT_LOAN_LIST_PAGE_SIZE,
    });
  });

  it.each(["assetCode", "checkedOutAt", "dueAt", "returnedAt"])(
    "accepts %s as a sort key",
    (sort) => {
      expect(parse({ sort }).sort).toBe(sort);
    },
  );

  it.each([
    { label: "an unknown sort key", raw: { sort: "borrowerName" } },
    { label: "a repeated sort param", raw: { sort: ["dueAt", "assetCode"] } },
    { label: "a non-string sort key", raw: { sort: 3 } },
  ])("falls back to the default sort key for $label", ({ raw }) => {
    expect(parse(raw).sort).toBe(DEFAULT_LOAN_LIST_SORT_KEY);
  });

  it.each([
    { label: "an unknown direction", raw: { dir: "sideways" } },
    { label: "a repeated direction param", raw: { dir: ["asc", "desc"] } },
  ])("falls back to the default direction for $label", ({ raw }) => {
    expect(parse(raw).dir).toBe(DEFAULT_LOAN_LIST_SORT_DIRECTION);
  });

  it.each(["active", "overdue", "returned"])(
    "accepts the %s state",
    (state) => {
      expect(parse({ state }).state).toBe(state);
    },
  );

  it.each([
    { label: "an unknown state", raw: { state: "pending" } },
    { label: "a repeated state param", raw: { state: ["active", "overdue"] } },
    { label: "an empty state", raw: { state: "" } },
    { label: "a non-string state", raw: { state: 7 } },
  ])("falls back to no state filter for $label", ({ raw }) => {
    expect(parse(raw).state).toBeUndefined();
  });

  it("trims the search term", () => {
    expect(parse({ q: "  budi  " }).q).toBe("budi");
  });

  it.each([
    { label: "an empty search", raw: { q: "   " } },
    { label: "a repeated search param", raw: { q: ["a", "b"] } },
    { label: "an over-long search", raw: { q: "x".repeat(201) } },
  ])("falls back to no search for $label", ({ raw }) => {
    expect(parse(raw).q).toBeUndefined();
  });

  it.each([
    { label: "a page below the first", raw: { page: "0" } },
    { label: "a negative page", raw: { page: "-4" } },
    { label: "a non-numeric page", raw: { page: "second" } },
    { label: "a fractional page", raw: { page: "1.5" } },
  ])("falls back to page 1 for $label", ({ raw }) => {
    expect(parse(raw).page).toBe(FIRST_LOAN_LIST_PAGE);
  });

  it("accepts a page number in range", () => {
    expect(parse({ page: "3" }).page).toBe(3);
  });

  it.each([
    {
      label: "below the minimum",
      raw: { pageSize: String(MIN_LOAN_LIST_PAGE_SIZE - 1) },
    },
    {
      label: "above the maximum",
      raw: { pageSize: String(MAX_LOAN_LIST_PAGE_SIZE + 1) },
    },
    { label: "not a number", raw: { pageSize: "many" } },
  ])("falls back to the default page size when it is $label", ({ raw }) => {
    expect(parse(raw).pageSize).toBe(DEFAULT_LOAN_LIST_PAGE_SIZE);
  });

  it("accepts a page size in range", () => {
    expect(parse({ pageSize: String(MIN_LOAN_LIST_PAGE_SIZE) }).pageSize).toBe(
      MIN_LOAN_LIST_PAGE_SIZE,
    );
  });

  it("never throws, whatever it is handed", () => {
    expect(() =>
      parse({ q: null, state: {}, page: [], pageSize: false }),
    ).not.toThrow();
  });
});

describe("withLoanListPage", () => {
  it("carries the state filter and the page, and nothing else, by default", () => {
    const params = parse({ state: "overdue" });
    expect(withLoanListPage(params, 2)).toBe("state=overdue&page=2");
  });

  it("omits the first page and the default page size", () => {
    expect(withLoanListPage(parse({}), 1)).toBe("");
  });

  it("keeps a non-default page size", () => {
    const params = parse({ pageSize: String(MAX_LOAN_LIST_PAGE_SIZE) });
    expect(withLoanListPage(params, 2)).toBe(
      `page=2&pageSize=${MAX_LOAN_LIST_PAGE_SIZE}`,
    );
  });

  it("round-trips a search term the user typed", () => {
    const params = parse({ q: "budi" });
    expect(withLoanListPage(params, 3)).toBe("q=budi&page=3");
  });
});

describe("withLoanListSort", () => {
  it("keeps the filters, applies the ordering and returns to the first page", () => {
    const params = withLoanListSort(
      parse({ state: "overdue", page: "4" }),
      "assetCode",
      "desc",
    );

    expect(params.get("state")).toBe("overdue");
    expect(params.get("sort")).toBe("assetCode");
    expect(params.get("dir")).toBe("desc");
    expect(params.has("page")).toBe(false);
  });
});

describe("buildLoanListViewParams", () => {
  it("carries only the non-default view controls, never a filter", () => {
    const params = buildLoanListViewParams(
      parse({ q: "budi", sort: "assetCode", pageSize: "50" }),
    );

    expect(params.has("q")).toBe(false);
    expect(params.get("sort")).toBe("assetCode");
    expect(params.get("pageSize")).toBe("50");
  });
});

describe("buildLoanListParamsWithoutPageSize", () => {
  it("drops the page size and the page, keeping filters and ordering", () => {
    const params = buildLoanListParamsWithoutPageSize(
      parse({ q: "budi", sort: "assetCode", page: "4", pageSize: "100" }),
    );

    expect(params.get("q")).toBe("budi");
    expect(params.get("sort")).toBe("assetCode");
    expect(params.has("pageSize")).toBe(false);
    expect(params.has("page")).toBe(false);
  });
});
