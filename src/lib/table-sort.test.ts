import { describe, expect, it } from "vitest";

import {
  appendTableViewParams,
  ariaSortValue,
  buildTablePageWindow,
  countTablePages,
  DEFAULT_TABLE_PAGE_SIZE,
  FIRST_TABLE_PAGE,
  MAX_TABLE_PAGE_SIZE,
  MIN_TABLE_PAGE_SIZE,
  nextSortDirection,
  readPageParam,
  readPageSizeParam,
  readParamInt,
  readParamString,
  readSortDirection,
  readSortKey,
  TABLE_PAGE_SIZE_OPTIONS,
  type SortDirection,
  type TableViewDefaults,
} from "./table-sort";

const SORT_KEYS = ["code", "name", "createdAt"] as const;

describe("the preset page-size scale", () => {
  it("is 10 / 20 / 50 / 100, defaulting to the smallest", () => {
    expect(TABLE_PAGE_SIZE_OPTIONS).toEqual([10, 20, 50, 100]);
    expect(DEFAULT_TABLE_PAGE_SIZE).toBe(10);
    expect(MIN_TABLE_PAGE_SIZE).toBe(10);
    expect(MAX_TABLE_PAGE_SIZE).toBe(100);
  });
});

describe("readParamString", () => {
  it.each([
    { label: "a trimmed string", raw: "  code  ", expected: "code" },
    { label: "a blank string", raw: "   ", expected: undefined },
    { label: "a repeated param", raw: ["a", "b"], expected: undefined },
    { label: "a number", raw: 7, expected: undefined },
    { label: "null", raw: null, expected: undefined },
    { label: "undefined", raw: undefined, expected: undefined },
  ])("reads $label as $expected", ({ raw, expected }) => {
    expect(readParamString(raw)).toBe(expected);
  });
});

describe("readParamInt", () => {
  it.each([
    { label: "an integer", raw: "42", expected: 42 },
    { label: "a negative integer", raw: "-3", expected: -3 },
    { label: "a fraction", raw: "1.5", expected: undefined },
    { label: "a word", raw: "many", expected: undefined },
    { label: "a repeated param", raw: ["1", "2"], expected: undefined },
  ])("reads $label as $expected", ({ raw, expected }) => {
    expect(readParamInt(raw)).toBe(expected);
  });
});

describe("readSortKey", () => {
  it.each(SORT_KEYS)("accepts the whitelisted key %s", (key) => {
    expect(readSortKey(key, SORT_KEYS, "code")).toBe(key);
  });

  it.each([
    { label: "a column that is not offered", raw: "isActive" },
    { label: "an order-by fragment", raw: "name; DROP TABLE room" },
    { label: "a repeated param", raw: ["code", "name"] },
    { label: "a blank value", raw: "" },
    { label: "nothing at all", raw: undefined },
  ])("falls back to the default for $label", ({ raw }) => {
    expect(readSortKey(raw, SORT_KEYS, "code")).toBe("code");
  });
});

describe("readSortDirection", () => {
  it.each(["asc", "desc"] as const)("accepts %s", (direction) => {
    expect(readSortDirection(direction, "asc")).toBe(direction);
  });

  it.each([
    { label: "an unknown direction", raw: "sideways" },
    { label: "a repeated param", raw: ["asc", "desc"] },
    { label: "nothing at all", raw: undefined },
  ])("falls back to the given default for $label", ({ raw }) => {
    expect(readSortDirection(raw, "desc")).toBe("desc");
  });
});

describe("readPageParam", () => {
  it("accepts a page number in range", () => {
    expect(readPageParam("3")).toBe(3);
  });

  it.each([
    { label: "zero", raw: "0" },
    { label: "a negative page", raw: "-4" },
    { label: "a fraction", raw: "1.5" },
    { label: "a word", raw: "second" },
    { label: "nothing at all", raw: undefined },
  ])("falls back to the first page for $label", ({ raw }) => {
    expect(readPageParam(raw)).toBe(FIRST_TABLE_PAGE);
  });
});

describe("readPageSizeParam", () => {
  it.each(TABLE_PAGE_SIZE_OPTIONS)("accepts the preset %i", (size) => {
    expect(readPageSizeParam(String(size))).toBe(size);
  });

  it.each([
    { label: "below the minimum", raw: String(MIN_TABLE_PAGE_SIZE - 1) },
    { label: "above the maximum", raw: String(MAX_TABLE_PAGE_SIZE + 1) },
    { label: "absurdly large", raw: "999999" },
    { label: "negative", raw: "-10" },
    { label: "not a number", raw: "many" },
    { label: "nothing at all", raw: undefined },
  ])("clamps back to the default when it is $label", ({ raw }) => {
    expect(readPageSizeParam(raw)).toBe(DEFAULT_TABLE_PAGE_SIZE);
  });
});

describe("nextSortDirection", () => {
  it.each([
    {
      label: "an inactive column takes its own first direction",
      isActive: false,
      current: "asc" as const,
      initial: "desc" as const,
      expected: "desc",
    },
    {
      label: "an inactive text column starts ascending",
      isActive: false,
      current: "desc" as const,
      initial: "asc" as const,
      expected: "asc",
    },
    {
      label: "an active ascending column flips to descending",
      isActive: true,
      current: "asc" as const,
      initial: "asc" as const,
      expected: "desc",
    },
    {
      label: "an active descending column flips to ascending",
      isActive: true,
      current: "desc" as const,
      initial: "desc" as const,
      expected: "asc",
    },
  ])("$label", ({ isActive, current, initial, expected }) => {
    expect(nextSortDirection(isActive, current, initial)).toBe(expected);
  });
});

describe("ariaSortValue", () => {
  it.each([
    { isActive: true, direction: "asc" as const, expected: "ascending" },
    { isActive: true, direction: "desc" as const, expected: "descending" },
    { isActive: false, direction: "asc" as const, expected: "none" },
    { isActive: false, direction: "desc" as const, expected: "none" },
  ])(
    "is $expected when active is $isActive and direction is $direction",
    ({ isActive, direction, expected }) => {
      expect(ariaSortValue(isActive, direction)).toBe(expected);
    },
  );
});

describe("buildTablePageWindow", () => {
  it.each([
    { page: 1, skip: 0 },
    { page: 2, skip: 10 },
    { page: 5, skip: 40 },
    { page: 0, skip: 0 },
    { page: -3, skip: 0 },
  ])("skips $skip rows for page $page", ({ page, skip }) => {
    expect(buildTablePageWindow(page, DEFAULT_TABLE_PAGE_SIZE)).toEqual({
      skip,
      take: DEFAULT_TABLE_PAGE_SIZE,
    });
  });
});

describe("countTablePages", () => {
  it.each([
    { totalCount: 0, expected: 1 },
    { totalCount: 1, expected: 1 },
    { totalCount: 10, expected: 1 },
    { totalCount: 11, expected: 2 },
    { totalCount: 40, expected: 4 },
  ])(
    "spans $expected pages for $totalCount rows",
    ({ totalCount, expected }) => {
      expect(countTablePages(totalCount, DEFAULT_TABLE_PAGE_SIZE)).toBe(
        expected,
      );
    },
  );
});

const VIEW_DEFAULTS: TableViewDefaults = { sort: "code", dir: "asc" };

function viewParams(
  sort: string,
  dir: SortDirection,
  page: number,
  pageSize: number,
): string {
  return appendTableViewParams(
    new URLSearchParams(),
    { sort, dir, page, pageSize },
    VIEW_DEFAULTS,
  ).toString();
}

describe("appendTableViewParams", () => {
  it("writes nothing when every value is already the default", () => {
    expect(viewParams("code", "asc", 1, DEFAULT_TABLE_PAGE_SIZE)).toBe("");
  });

  it("writes each value that deviates from its default", () => {
    expect(viewParams("name", "desc", 3, 50)).toBe(
      "sort=name&dir=desc&page=3&pageSize=50",
    );
  });

  it("keeps whatever the caller already put on the query string", () => {
    const base = new URLSearchParams({ buildingId: "bldg-1" });
    const params = appendTableViewParams(
      base,
      { sort: "name", dir: "asc", page: 1, pageSize: DEFAULT_TABLE_PAGE_SIZE },
      VIEW_DEFAULTS,
    );

    expect(params.toString()).toBe("buildingId=bldg-1&sort=name");
  });
});
