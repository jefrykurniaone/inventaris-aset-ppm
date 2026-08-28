import { describe, expect, it } from "vitest";

import {
  buildAttentionCountWhere,
  buildLiveAssetWhere,
  buildMissingPhotoCountWhere,
  computeTotalAcquisitionValue,
  shapeCategoryCounts,
  shapeStatusCounts,
  shapeYearCounts,
} from "./dashboard-metrics";

describe("buildLiveAssetWhere", () => {
  it("excludes soft-deleted assets", () => {
    expect(buildLiveAssetWhere()).toEqual({ deletedAt: null });
  });
});

describe("buildAttentionCountWhere", () => {
  it("combines the live-asset filter with the shared attention rule", () => {
    expect(buildAttentionCountWhere()).toEqual({
      deletedAt: null,
      OR: [{ status: { in: ["in_repair", "lost"] } }, { condition: "poor" }],
    });
  });
});

describe("buildMissingPhotoCountWhere", () => {
  it("combines the live-asset filter with the shared missing-photo rule", () => {
    expect(buildMissingPhotoCountWhere()).toEqual({
      deletedAt: null,
      photos: { none: {} },
    });
  });
});

describe("shapeStatusCounts", () => {
  it("fills a zero row for every status groupBy omitted", () => {
    expect(shapeStatusCounts([{ status: "active", _count: 7 }])).toEqual([
      { status: "active", count: 7 },
      { status: "in_repair", count: 0 },
      { status: "loaned", count: 0 },
      { status: "retired", count: 0 },
      { status: "lost", count: 0 },
    ]);
  });

  it("reports all five statuses in a fixed order regardless of input order", () => {
    const rows = shapeStatusCounts([
      { status: "lost", _count: 1 },
      { status: "active", _count: 2 },
    ]);
    expect(rows.map((row) => row.status)).toEqual([
      "active",
      "in_repair",
      "loaned",
      "retired",
      "lost",
    ]);
  });

  it("is every zero for an empty register", () => {
    const rows = shapeStatusCounts([]);
    expect(rows.every((row) => row.count === 0)).toBe(true);
  });
});

describe("shapeCategoryCounts", () => {
  it("joins category names in and sorts by count descending", () => {
    const nameById = new Map([
      ["cat-1", "Elektronik"],
      ["cat-2", "Furnitur"],
    ]);
    expect(
      shapeCategoryCounts(
        [
          { categoryId: "cat-2", _count: 3 },
          { categoryId: "cat-1", _count: 9 },
        ],
        nameById,
      ),
    ).toEqual([
      { categoryId: "cat-1", categoryName: "Elektronik", count: 9 },
      { categoryId: "cat-2", categoryName: "Furnitur", count: 3 },
    ]);
  });

  it("breaks a tied count alphabetically by name for a stable order", () => {
    const nameById = new Map([
      ["cat-1", "Zebra"],
      ["cat-2", "Alpha"],
    ]);
    const rows = shapeCategoryCounts(
      [
        { categoryId: "cat-1", _count: 5 },
        { categoryId: "cat-2", _count: 5 },
      ],
      nameById,
    );
    expect(rows.map((row) => row.categoryName)).toEqual(["Alpha", "Zebra"]);
  });

  it("falls back to the id when a category name is missing from the map", () => {
    expect(
      shapeCategoryCounts([{ categoryId: "cat-orphan", _count: 1 }], new Map()),
    ).toEqual([
      { categoryId: "cat-orphan", categoryName: "cat-orphan", count: 1 },
    ]);
  });

  it("is an empty list for an empty register", () => {
    expect(shapeCategoryCounts([], new Map())).toEqual([]);
  });
});

describe("shapeYearCounts", () => {
  it("sorts ascending by year", () => {
    expect(
      shapeYearCounts([
        { acquisitionYear: 2024, _count: 4 },
        { acquisitionYear: 2020, _count: 1 },
        { acquisitionYear: 2022, _count: 2 },
      ]),
    ).toEqual([
      { year: 2020, count: 1 },
      { year: 2022, count: 2 },
      { year: 2024, count: 4 },
    ]);
  });

  it("is an empty list for an empty register", () => {
    expect(shapeYearCounts([])).toEqual([]);
  });
});

describe("computeTotalAcquisitionValue", () => {
  it("reads a Decimal-like value through Number()", () => {
    expect(computeTotalAcquisitionValue({ toString: () => "1500000.50" })).toBe(
      1500000.5,
    );
  });

  it("is zero for null — no live asset carries a price", () => {
    expect(computeTotalAcquisitionValue(null)).toBe(0);
  });

  it("is zero for undefined", () => {
    expect(computeTotalAcquisitionValue(undefined)).toBe(0);
  });
});
