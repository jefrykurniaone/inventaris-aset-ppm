import { describe, expect, it } from "vitest";

import {
  buildAssetListParamsWithoutPageSize,
  buildAssetListSearchParams,
  buildAssetListViewParams,
  withAssetListPage,
  withAssetListSort,
  type AssetListUrlState,
} from "./asset-list-url";

const DEFAULT_STATE: AssetListUrlState = {
  sort: "createdAt",
  dir: "desc",
  page: 1,
  pageSize: 10,
};

describe("buildAssetListSearchParams", () => {
  it("is empty when every value is already the default", () => {
    expect(buildAssetListSearchParams(DEFAULT_STATE).toString()).toBe("");
  });

  it("includes every non-default filter", () => {
    const params = buildAssetListSearchParams({
      ...DEFAULT_STATE,
      q: "proj",
      categoryId: "cat-1",
      buildingId: "bldg-1",
      roomId: "room-1",
      status: "active",
      condition: "good",
      acquisitionYear: 2026,
      fundingSourceId: "fund-1",
    });

    expect(params.get("q")).toBe("proj");
    expect(params.get("categoryId")).toBe("cat-1");
    expect(params.get("buildingId")).toBe("bldg-1");
    expect(params.get("roomId")).toBe("room-1");
    expect(params.get("status")).toBe("active");
    expect(params.get("condition")).toBe("good");
    expect(params.get("acquisitionYear")).toBe("2026");
    expect(params.get("fundingSourceId")).toBe("fund-1");
  });

  it("includes sort, direction, page and page size only away from their defaults", () => {
    const params = buildAssetListSearchParams({
      ...DEFAULT_STATE,
      sort: "name",
      dir: "asc",
      page: 3,
      pageSize: 50,
    });

    expect(params.get("sort")).toBe("name");
    expect(params.get("dir")).toBe("asc");
    expect(params.get("page")).toBe("3");
    expect(params.get("pageSize")).toBe("50");
  });
});

describe("withAssetListSort", () => {
  it("keeps the filters, applies the ordering and returns to the first page", () => {
    const params = withAssetListSort(
      { ...DEFAULT_STATE, q: "proj", page: 4 },
      "name",
      "asc",
    );

    expect(params.get("q")).toBe("proj");
    expect(params.get("sort")).toBe("name");
    expect(params.get("dir")).toBe("asc");
    expect(params.has("page")).toBe(false);
  });
});

describe("buildAssetListViewParams", () => {
  it("carries only the non-default view controls, never a filter", () => {
    const params = buildAssetListViewParams({
      ...DEFAULT_STATE,
      q: "proj",
      sort: "assetCode",
      pageSize: 50,
    });

    expect(params.has("q")).toBe(false);
    expect(params.get("sort")).toBe("assetCode");
    expect(params.get("pageSize")).toBe("50");
  });
});

describe("buildAssetListParamsWithoutPageSize", () => {
  it("drops the page size and the page, keeping filters and ordering", () => {
    const params = buildAssetListParamsWithoutPageSize({
      ...DEFAULT_STATE,
      q: "proj",
      sort: "name",
      page: 4,
      pageSize: 100,
    });

    expect(params.get("q")).toBe("proj");
    expect(params.get("sort")).toBe("name");
    expect(params.has("pageSize")).toBe(false);
    expect(params.has("page")).toBe(false);
  });
});

describe("withAssetListPage", () => {
  it("carries every current filter forward onto a new page", () => {
    const query = withAssetListPage(
      { ...DEFAULT_STATE, q: "proj", status: "active" },
      3,
    );
    const params = new URLSearchParams(query);

    expect(params.get("q")).toBe("proj");
    expect(params.get("status")).toBe("active");
    expect(params.get("page")).toBe("3");
  });

  it("omits page when it is set back to the first page", () => {
    const query = withAssetListPage({ ...DEFAULT_STATE, page: 2 }, 1);
    expect(new URLSearchParams(query).has("page")).toBe(false);
  });
});
