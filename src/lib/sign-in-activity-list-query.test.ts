import { describe, expect, it } from "vitest";

import {
  buildSignInActivityListOrderBy,
  buildSignInActivityListPageWindow,
  buildSignInActivityListPagerParams,
  buildSignInActivityListParamsWithoutPageSize,
  buildSignInActivityListViewParams,
  buildSignInActivityListWhere,
  DEFAULT_SIGN_IN_ACTIVITY_SORT_DIRECTION,
  DEFAULT_SIGN_IN_ACTIVITY_SORT_KEY,
  parseSignInActivityListParams,
  SIGN_IN_ACTIVITY_LIST_SORT_KEYS,
  totalSignInActivityListPageCount,
  withSignInActivityListSort,
} from "./sign-in-activity-list-query";

describe("parseSignInActivityListParams", () => {
  it("defaults to newest attempt first, ten to a page, no filters", () => {
    expect(parseSignInActivityListParams({})).toEqual({
      search: undefined,
      outcome: undefined,
      sort: "createdAt",
      dir: "desc",
      page: 1,
      pageSize: 10,
    });
  });

  it("defaults the same way when handed nothing at all", () => {
    expect(parseSignInActivityListParams(undefined).sort).toBe(
      DEFAULT_SIGN_IN_ACTIVITY_SORT_KEY,
    );
  });

  it.each(SIGN_IN_ACTIVITY_LIST_SORT_KEYS)(
    "accepts %s as a sort key",
    (sort) => {
      expect(parseSignInActivityListParams({ sort }).sort).toBe(sort);
    },
  );

  it.each([
    { label: "a column the trail does not offer", raw: { sort: "email" } },
    { label: "a repeated sort param", raw: { sort: ["createdAt", "email"] } },
    { label: "a non-string sort key", raw: { sort: 4 } },
  ])("falls back to the default sort key for $label", ({ raw }) => {
    expect(parseSignInActivityListParams(raw).sort).toBe(
      DEFAULT_SIGN_IN_ACTIVITY_SORT_KEY,
    );
  });

  it.each([
    { label: "an unknown direction", raw: { dir: "sideways" } },
    { label: "a repeated direction param", raw: { dir: ["asc", "desc"] } },
  ])("falls back to the default direction for $label", ({ raw }) => {
    expect(parseSignInActivityListParams(raw).dir).toBe(
      DEFAULT_SIGN_IN_ACTIVITY_SORT_DIRECTION,
    );
  });

  it("trims the address search term", () => {
    expect(
      parseSignInActivityListParams({ search: "  a@b.com  " }).search,
    ).toBe("a@b.com");
  });

  it.each([
    { label: "an empty search", raw: { search: "   " } },
    { label: "a repeated search param", raw: { search: ["a", "b"] } },
    { label: "an over-long search", raw: { search: "x".repeat(201) } },
  ])("falls back to no search for $label", ({ raw }) => {
    expect(parseSignInActivityListParams(raw).search).toBeUndefined();
  });

  it.each(["succeeded", "failed", "blocked"])(
    "accepts the %s outcome",
    (outcome) => {
      expect(parseSignInActivityListParams({ outcome }).outcome).toBe(outcome);
    },
  );

  it.each([
    { label: "an unknown outcome", raw: { outcome: "pending" } },
    {
      label: "a repeated outcome param",
      raw: { outcome: ["succeeded", "failed"] },
    },
    { label: "an empty outcome", raw: { outcome: "" } },
    { label: "a non-string outcome", raw: { outcome: 1 } },
  ])("falls back to no outcome filter for $label", ({ raw }) => {
    expect(parseSignInActivityListParams(raw).outcome).toBeUndefined();
  });

  it.each([
    { label: "below the minimum", raw: { pageSize: "9" } },
    { label: "above the maximum", raw: { pageSize: "101" } },
    { label: "not a number", raw: { pageSize: "lots" } },
  ])("clamps a page size that is $label", ({ raw }) => {
    expect(parseSignInActivityListParams(raw).pageSize).toBe(10);
  });

  it.each([
    { label: "a page below the first", raw: { page: "0" } },
    { label: "a negative page", raw: { page: "-4" } },
    { label: "a non-numeric page", raw: { page: "second" } },
  ])("falls back to page 1 for $label", ({ raw }) => {
    expect(parseSignInActivityListParams(raw).page).toBe(1);
  });

  it("never throws, whatever it is handed", () => {
    expect(() =>
      parseSignInActivityListParams({
        search: {},
        outcome: [],
        sort: false,
        dir: null,
        page: {},
        pageSize: [],
      }),
    ).not.toThrow();
  });
});

describe("buildSignInActivityListWhere", () => {
  it("matches every attempt with no filters", () => {
    expect(buildSignInActivityListWhere({})).toEqual({});
  });

  it("filters by outcome alone", () => {
    expect(buildSignInActivityListWhere({ outcome: "blocked" })).toEqual({
      outcome: "blocked",
    });
  });

  it("searches the address with a trimmed, case-insensitive contains", () => {
    expect(buildSignInActivityListWhere({ search: "  a@b.com  " })).toEqual({
      email: { contains: "a@b.com", mode: "insensitive" },
    });
  });

  it("omits the search clause for an empty or whitespace-only term", () => {
    expect(buildSignInActivityListWhere({ search: "" })).toEqual({});
    expect(buildSignInActivityListWhere({ search: "   " })).toEqual({});
  });

  it("combines outcome and search with AND", () => {
    expect(
      buildSignInActivityListWhere({ outcome: "failed", search: "a@b.com" }),
    ).toEqual({
      outcome: "failed",
      email: { contains: "a@b.com", mode: "insensitive" },
    });
  });

  it("never compiles a RegExp from the search term (S5852, S8786)", () => {
    const hostile = "a".repeat(50) + "!";
    expect(buildSignInActivityListWhere({ search: hostile })).toEqual({
      email: { contains: hostile, mode: "insensitive" },
    });
  });
});

describe("buildSignInActivityListOrderBy", () => {
  it("builds a single-column orderBy in each direction", () => {
    expect(buildSignInActivityListOrderBy("createdAt", "desc")).toEqual({
      createdAt: "desc",
    });
    expect(buildSignInActivityListOrderBy("createdAt", "asc")).toEqual({
      createdAt: "asc",
    });
  });
});

describe("buildSignInActivityListPageWindow", () => {
  it("computes zero-based skip from a one-based page", () => {
    expect(buildSignInActivityListPageWindow(1, 10)).toEqual({
      skip: 0,
      take: 10,
    });
    expect(buildSignInActivityListPageWindow(3, 10)).toEqual({
      skip: 20,
      take: 10,
    });
  });

  it("clamps a page below 1 to the first page", () => {
    expect(buildSignInActivityListPageWindow(0, 10)).toEqual({
      skip: 0,
      take: 10,
    });
  });
});

describe("totalSignInActivityListPageCount", () => {
  it.each([
    { totalCount: 0, expected: 1 },
    { totalCount: 10, expected: 1 },
    { totalCount: 11, expected: 2 },
  ])(
    "spans $expected pages for $totalCount attempts",
    ({ totalCount, expected }) => {
      expect(totalSignInActivityListPageCount(totalCount, 10)).toBe(expected);
    },
  );
});

describe("sign-in activity URL round-trips", () => {
  it("puts the ordering in the URL and returns to the first page", () => {
    const params = withSignInActivityListSort(
      parseSignInActivityListParams({ page: "4" }),
      "createdAt",
      "asc",
    );

    expect(params.toString()).toBe("dir=asc");
  });

  it("keeps a search term and an outcome filter in the sort target", () => {
    const params = withSignInActivityListSort(
      parseSignInActivityListParams({
        search: "a@b.com",
        outcome: "failed",
      }),
      "createdAt",
      "asc",
    );

    expect(params.get("search")).toBe("a@b.com");
    expect(params.get("outcome")).toBe("failed");
    expect(params.get("dir")).toBe("asc");
  });

  it("keeps the ordering and page size out of the pager's own page param", () => {
    const params = buildSignInActivityListPagerParams(
      parseSignInActivityListParams({
        outcome: "failed",
        page: "4",
        pageSize: "50",
      }),
    );

    expect(params.get("outcome")).toBe("failed");
    expect(params.get("pageSize")).toBe("50");
    expect(params.has("page")).toBe(false);
  });

  it("carries only the non-default view controls for the filter form, never a filter", () => {
    const params = buildSignInActivityListViewParams(
      parseSignInActivityListParams({
        search: "a@b.com",
        outcome: "failed",
        pageSize: "50",
      }),
    );

    expect(params.has("search")).toBe(false);
    expect(params.has("outcome")).toBe(false);
    expect(params.get("pageSize")).toBe("50");
    expect(params.has("page")).toBe(false);
  });

  it("drops the page size and the page for the page-size control", () => {
    const params = buildSignInActivityListParamsWithoutPageSize(
      parseSignInActivityListParams({
        outcome: "failed",
        page: "4",
        pageSize: "50",
      }),
    );

    expect(params.get("outcome")).toBe("failed");
    expect(params.has("pageSize")).toBe(false);
    expect(params.has("page")).toBe(false);
  });
});
