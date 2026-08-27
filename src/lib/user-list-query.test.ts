import { describe, expect, it } from "vitest";

import {
  buildUserListPagerParams,
  buildUserListParamsWithoutPageSize,
  buildUserListQuery,
  DEFAULT_USER_LIST_SORT_DIRECTION,
  DEFAULT_USER_LIST_SORT_KEY,
  parseUserListParams,
  totalUserListPageCount,
  USER_LIST_SORT_KEYS,
  withUserListSort,
} from "./user-list-query";

describe("parseUserListParams", () => {
  it("defaults to newest account first, ten to a page", () => {
    expect(parseUserListParams({})).toEqual({
      sort: "createdAt",
      dir: "desc",
      page: 1,
      pageSize: 10,
    });
  });

  it("defaults the same way when handed nothing at all", () => {
    expect(parseUserListParams(undefined).sort).toBe(
      DEFAULT_USER_LIST_SORT_KEY,
    );
  });

  it.each(USER_LIST_SORT_KEYS)("accepts %s as a sort key", (sort) => {
    expect(parseUserListParams({ sort }).sort).toBe(sort);
  });

  it.each([
    { label: "a column the list does not offer", raw: { sort: "banReason" } },
    { label: "a repeated sort param", raw: { sort: ["name", "email"] } },
    { label: "a non-string sort key", raw: { sort: 4 } },
  ])("falls back to the default sort key for $label", ({ raw }) => {
    expect(parseUserListParams(raw).sort).toBe(DEFAULT_USER_LIST_SORT_KEY);
  });

  it.each([
    { label: "an unknown direction", raw: { dir: "sideways" } },
    { label: "a repeated direction param", raw: { dir: ["asc", "desc"] } },
  ])("falls back to the default direction for $label", ({ raw }) => {
    expect(parseUserListParams(raw).dir).toBe(DEFAULT_USER_LIST_SORT_DIRECTION);
  });

  it.each([
    { label: "below the minimum", raw: { pageSize: "9" } },
    { label: "above the maximum", raw: { pageSize: "101" } },
    { label: "not a number", raw: { pageSize: "lots" } },
  ])("clamps a page size that is $label", ({ raw }) => {
    expect(parseUserListParams(raw).pageSize).toBe(10);
  });

  it("never throws, whatever it is handed", () => {
    expect(() =>
      parseUserListParams({ sort: {}, dir: [], page: false, pageSize: null }),
    ).not.toThrow();
  });
});

describe("buildUserListQuery", () => {
  it("translates a page number into the admin plugin's limit and offset", () => {
    expect(
      buildUserListQuery({
        sort: "email",
        dir: "asc",
        page: 3,
        pageSize: 20,
      }),
    ).toEqual({
      limit: 20,
      offset: 40,
      sortBy: "email",
      sortDirection: "asc",
    });
  });

  it("asks for the first page with no offset", () => {
    expect(buildUserListQuery(parseUserListParams({})).offset).toBe(0);
  });
});

describe("totalUserListPageCount", () => {
  it.each([
    { totalCount: 0, expected: 1 },
    { totalCount: 10, expected: 1 },
    { totalCount: 11, expected: 2 },
  ])(
    "spans $expected pages for $totalCount users",
    ({ totalCount, expected }) => {
      expect(totalUserListPageCount(totalCount, 10)).toBe(expected);
    },
  );
});

describe("user list URL round-trips", () => {
  it("puts the ordering in the URL and returns to the first page", () => {
    const params = withUserListSort(
      parseUserListParams({ page: "4" }),
      "name",
      "asc",
    );

    expect(params.toString()).toBe("sort=name&dir=asc");
  });

  it("keeps the ordering and page size out of the pager's own page param", () => {
    const params = buildUserListPagerParams(
      parseUserListParams({ sort: "email", page: "4", pageSize: "50" }),
    );

    expect(params.get("sort")).toBe("email");
    expect(params.get("pageSize")).toBe("50");
    expect(params.has("page")).toBe(false);
  });

  it("drops the page size and the page for the page-size control", () => {
    const params = buildUserListParamsWithoutPageSize(
      parseUserListParams({ sort: "email", page: "4", pageSize: "50" }),
    );

    expect(params.get("sort")).toBe("email");
    expect(params.has("pageSize")).toBe(false);
    expect(params.has("page")).toBe(false);
  });
});
