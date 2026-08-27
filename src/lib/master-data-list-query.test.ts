import { describe, expect, it } from "vitest";

import {
  buildMasterDataOrderBy,
  buildMasterDataPagerParams,
  buildMasterDataParamsWithoutPageSize,
  buildRoomListOrderBy,
  DEFAULT_FUNDING_SOURCE_SORT_KEY,
  DEFAULT_MASTER_DATA_SORT_DIRECTION,
  DEFAULT_MASTER_DATA_SORT_KEY,
  FUNDING_SOURCE_SORT_KEYS,
  MASTER_DATA_SORT_KEYS,
  parseMasterDataListParams,
  withMasterDataSort,
} from "./master-data-list-query";

function parseCoded(raw: unknown) {
  return parseMasterDataListParams(
    raw,
    MASTER_DATA_SORT_KEYS,
    DEFAULT_MASTER_DATA_SORT_KEY,
  );
}

describe("parseMasterDataListParams", () => {
  it("defaults to code order, ascending, ten to a page", () => {
    expect(parseCoded({})).toEqual({
      sort: "code",
      dir: "asc",
      page: 1,
      pageSize: 10,
    });
  });

  it("defaults funding sources to name order, which have no code column", () => {
    const params = parseMasterDataListParams(
      {},
      FUNDING_SOURCE_SORT_KEYS,
      DEFAULT_FUNDING_SOURCE_SORT_KEY,
    );
    expect(params.sort).toBe("name");
  });

  it.each(MASTER_DATA_SORT_KEYS)("accepts %s on a coded table", (sort) => {
    expect(parseCoded({ sort }).sort).toBe(sort);
  });

  it("refuses a key one table has but another does not", () => {
    const params = parseMasterDataListParams(
      { sort: "code" },
      FUNDING_SOURCE_SORT_KEYS,
      DEFAULT_FUNDING_SOURCE_SORT_KEY,
    );
    expect(params.sort).toBe(DEFAULT_FUNDING_SOURCE_SORT_KEY);
  });

  it.each([
    { label: "a column that is not offered", raw: { sort: "isActive" } },
    { label: "a repeated sort param", raw: { sort: ["code", "name"] } },
    { label: "an order-by fragment", raw: { sort: "name DESC, id" } },
  ])("falls back to the default sort key for $label", ({ raw }) => {
    expect(parseCoded(raw).sort).toBe(DEFAULT_MASTER_DATA_SORT_KEY);
  });

  it.each([
    { label: "an unknown direction", raw: { dir: "sideways" } },
    { label: "a repeated direction param", raw: { dir: ["asc", "desc"] } },
  ])("falls back to the default direction for $label", ({ raw }) => {
    expect(parseCoded(raw).dir).toBe(DEFAULT_MASTER_DATA_SORT_DIRECTION);
  });

  it.each([
    { label: "below the minimum", raw: { pageSize: "9" } },
    { label: "above the maximum", raw: { pageSize: "101" } },
    { label: "not a number", raw: { pageSize: "lots" } },
  ])("clamps a page size that is $label", ({ raw }) => {
    expect(parseCoded(raw).pageSize).toBe(10);
  });

  it("ignores a filter param the page parses for itself", () => {
    expect(parseCoded({ buildingId: "bldg-1" })).not.toHaveProperty(
      "buildingId",
    );
  });

  it("never throws, whatever it is handed", () => {
    expect(() =>
      parseCoded({ sort: {}, dir: [], page: false, pageSize: null }),
    ).not.toThrow();
  });
});

describe("buildMasterDataOrderBy", () => {
  it.each(MASTER_DATA_SORT_KEYS)(
    "orders by %s with a stable tie-break",
    (key) => {
      expect(buildMasterDataOrderBy(key, "desc")).toEqual([
        { [key]: "desc" },
        { id: "desc" },
      ]);
    },
  );
});

describe("buildRoomListOrderBy", () => {
  it("orders by building before room code, which repeats between buildings", () => {
    expect(buildRoomListOrderBy("code", "asc")).toEqual([
      { building: { code: "asc" } },
      { code: "asc" },
      { id: "asc" },
    ]);
  });

  it.each(["name", "createdAt"] as const)(
    "orders by %s on the room's own column",
    (key) => {
      expect(buildRoomListOrderBy(key, "desc")).toEqual([
        { [key]: "desc" },
        { id: "desc" },
      ]);
    },
  );
});

describe("master-data URL round-trips", () => {
  const buildingFilter = new URLSearchParams({ buildingId: "bldg-1" });

  it("keeps the building filter through a header sort and resets the page", () => {
    const params = withMasterDataSort(
      buildingFilter,
      parseCoded({ page: "4" }),
      DEFAULT_MASTER_DATA_SORT_KEY,
      "name",
      "desc",
    );

    expect(params.get("buildingId")).toBe("bldg-1");
    expect(params.get("sort")).toBe("name");
    expect(params.get("dir")).toBe("desc");
    expect(params.has("page")).toBe(false);
  });

  it("leaves the pager to set the page itself", () => {
    const params = buildMasterDataPagerParams(
      buildingFilter,
      parseCoded({ sort: "name", page: "4", pageSize: "50" }),
      DEFAULT_MASTER_DATA_SORT_KEY,
    );

    expect(params.get("sort")).toBe("name");
    expect(params.get("pageSize")).toBe("50");
    expect(params.has("page")).toBe(false);
  });

  it("drops the page size and the page for the page-size control", () => {
    const params = buildMasterDataParamsWithoutPageSize(
      buildingFilter,
      parseCoded({ sort: "name", page: "4", pageSize: "50" }),
      DEFAULT_MASTER_DATA_SORT_KEY,
    );

    expect(params.get("buildingId")).toBe("bldg-1");
    expect(params.get("sort")).toBe("name");
    expect(params.has("pageSize")).toBe(false);
    expect(params.has("page")).toBe(false);
  });

  it("does not mutate the base params it is handed", () => {
    withMasterDataSort(
      buildingFilter,
      parseCoded({}),
      DEFAULT_MASTER_DATA_SORT_KEY,
      "name",
      "desc",
    );
    expect(buildingFilter.toString()).toBe("buildingId=bldg-1");
  });
});
