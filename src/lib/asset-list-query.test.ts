import { describe, expect, it } from "vitest";

import {
  ASSET_LIST_SORT_KEYS,
  buildAssetListOrderBy,
  buildAssetListPageWindow,
  buildAssetListWhere,
  DEFAULT_ASSET_LIST_PAGE_SIZE,
  DEFAULT_ASSET_LIST_SORT_DIRECTION,
  DEFAULT_ASSET_LIST_SORT_KEY,
  totalAssetListPageCount,
} from "./asset-list-query";

describe("buildAssetListWhere", () => {
  it("excludes soft-deleted assets with no other filters", () => {
    expect(buildAssetListWhere({})).toEqual({ deletedAt: null });
  });

  it("applies each scalar filter independently", () => {
    expect(buildAssetListWhere({ categoryId: "cat-1" })).toEqual({
      deletedAt: null,
      categoryId: "cat-1",
    });
    expect(buildAssetListWhere({ roomId: "room-1" })).toEqual({
      deletedAt: null,
      roomId: "room-1",
    });
    expect(buildAssetListWhere({ status: "active" })).toEqual({
      deletedAt: null,
      status: "active",
    });
    expect(buildAssetListWhere({ condition: "good" })).toEqual({
      deletedAt: null,
      condition: "good",
    });
    expect(buildAssetListWhere({ acquisitionYear: 2026 })).toEqual({
      deletedAt: null,
      acquisitionYear: 2026,
    });
    expect(buildAssetListWhere({ fundingSourceId: "fund-1" })).toEqual({
      deletedAt: null,
      fundingSourceId: "fund-1",
    });
  });

  it("filters by building through the room relation, not a column", () => {
    expect(buildAssetListWhere({ buildingId: "bldg-1" })).toEqual({
      deletedAt: null,
      room: { buildingId: "bldg-1" },
    });
  });

  it("combines every filter with AND", () => {
    expect(
      buildAssetListWhere({
        categoryId: "cat-1",
        buildingId: "bldg-1",
        roomId: "room-1",
        status: "active",
        condition: "good",
        acquisitionYear: 2026,
        fundingSourceId: "fund-1",
      }),
    ).toEqual({
      deletedAt: null,
      categoryId: "cat-1",
      room: { buildingId: "bldg-1" },
      roomId: "room-1",
      status: "active",
      condition: "good",
      acquisitionYear: 2026,
      fundingSourceId: "fund-1",
    });
  });

  it("builds an OR across all six search fields, trimmed and case-insensitive", () => {
    const where = buildAssetListWhere({ search: "  proj  " });
    expect(where.OR).toEqual([
      { name: { contains: "proj", mode: "insensitive" } },
      { assetCode: { contains: "proj", mode: "insensitive" } },
      { universityAssetCode: { contains: "proj", mode: "insensitive" } },
      { brand: { contains: "proj", mode: "insensitive" } },
      { model: { contains: "proj", mode: "insensitive" } },
      { serialNumber: { contains: "proj", mode: "insensitive" } },
    ]);
  });

  it("omits OR for an empty or whitespace-only search", () => {
    expect(buildAssetListWhere({ search: "" }).OR).toBeUndefined();
    expect(buildAssetListWhere({ search: "   " }).OR).toBeUndefined();
  });

  it("never compiles a RegExp from the search term (S5852, S8786)", () => {
    const hostile = "a".repeat(50) + "!";
    const where = buildAssetListWhere({ search: hostile });
    expect(where.OR?.[0]).toEqual({
      name: { contains: hostile, mode: "insensitive" },
    });
  });

  it("omits the attention clause when attention is not requested", () => {
    expect(buildAssetListWhere({}).AND).toBeUndefined();
  });

  it("ANDs the shared attention rule in, including the no-photo relation filter", () => {
    const where = buildAssetListWhere({ attention: true });
    expect(where.AND).toEqual([
      {
        OR: [
          { status: "in_repair" },
          { condition: "poor" },
          { photos: { none: {} } },
        ],
      },
    ]);
  });

  it("keeps the attention clause and a free-text search independent of each other", () => {
    const where = buildAssetListWhere({ attention: true, search: "proj" });
    expect(where.OR).toEqual([
      { name: { contains: "proj", mode: "insensitive" } },
      { assetCode: { contains: "proj", mode: "insensitive" } },
      { universityAssetCode: { contains: "proj", mode: "insensitive" } },
      { brand: { contains: "proj", mode: "insensitive" } },
      { model: { contains: "proj", mode: "insensitive" } },
      { serialNumber: { contains: "proj", mode: "insensitive" } },
    ]);
    expect(where.AND).toEqual([
      {
        OR: [
          { status: "in_repair" },
          { condition: "poor" },
          { photos: { none: {} } },
        ],
      },
    ]);
  });
});

describe("buildAssetListOrderBy", () => {
  it("builds a single-column orderBy for each sort key and direction", () => {
    expect(buildAssetListOrderBy("assetCode", "asc")).toEqual({
      assetCode: "asc",
    });
    expect(buildAssetListOrderBy("name", "desc")).toEqual({ name: "desc" });
    expect(buildAssetListOrderBy("acquisitionYear", "asc")).toEqual({
      acquisitionYear: "asc",
    });
    expect(buildAssetListOrderBy("createdAt", "desc")).toEqual({
      createdAt: "desc",
    });
  });
});

describe("asset list defaults", () => {
  it("orders newest registration first and pages ten rows at a time", () => {
    expect(DEFAULT_ASSET_LIST_SORT_KEY).toBe("createdAt");
    expect(DEFAULT_ASSET_LIST_SORT_DIRECTION).toBe("desc");
    expect(DEFAULT_ASSET_LIST_PAGE_SIZE).toBe(10);
  });

  it("offers exactly the four curated sortable columns", () => {
    expect(ASSET_LIST_SORT_KEYS).toEqual([
      "assetCode",
      "name",
      "acquisitionYear",
      "createdAt",
    ]);
  });
});

describe("buildAssetListPageWindow", () => {
  it("computes zero-based skip from a one-based page", () => {
    expect(buildAssetListPageWindow(1, DEFAULT_ASSET_LIST_PAGE_SIZE)).toEqual({
      skip: 0,
      take: DEFAULT_ASSET_LIST_PAGE_SIZE,
    });
    expect(buildAssetListPageWindow(3, 10)).toEqual({ skip: 20, take: 10 });
  });

  it("clamps a page below 1 to the first page", () => {
    expect(buildAssetListPageWindow(0, 10)).toEqual({ skip: 0, take: 10 });
    expect(buildAssetListPageWindow(-5, 10)).toEqual({ skip: 0, take: 10 });
  });
});

describe("totalAssetListPageCount", () => {
  it("is one page for zero results", () => {
    expect(totalAssetListPageCount(0, 20)).toBe(1);
  });

  it("rounds up a partial final page", () => {
    expect(totalAssetListPageCount(21, 20)).toBe(2);
  });

  it("is exact for a total that is a multiple of the page size", () => {
    expect(totalAssetListPageCount(40, 20)).toBe(2);
  });
});
