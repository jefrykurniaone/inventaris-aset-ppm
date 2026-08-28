import { describe, expect, it } from "vitest";

import { assetListSearchParamsSchema } from "./list-schemas";

describe("assetListSearchParamsSchema", () => {
  it("defaults every field when the search params object is empty", () => {
    const parsed = assetListSearchParamsSchema.parse({});

    expect(parsed).toEqual({
      q: undefined,
      categoryId: undefined,
      buildingId: undefined,
      roomId: undefined,
      fundingSourceId: undefined,
      status: undefined,
      condition: undefined,
      acquisitionYear: undefined,
      attention: false,
      noPhoto: false,
      sort: "createdAt",
      dir: "desc",
      page: 1,
      pageSize: 10,
    });
  });

  it("never throws on a garbage enum, out-of-range number or repeated param", () => {
    const parsed = assetListSearchParamsSchema.parse({
      status: "not-a-real-status",
      condition: "also-not-real",
      sort: "not-a-sort-key",
      dir: "sideways",
      page: "not-a-number",
      pageSize: "999999",
      acquisitionYear: "not-a-year",
      categoryId: ["a", "b"],
      attention: ["1", "1"],
      noPhoto: ["1", "1"],
    });

    expect(parsed.status).toBeUndefined();
    expect(parsed.condition).toBeUndefined();
    expect(parsed.sort).toBe("createdAt");
    expect(parsed.dir).toBe("desc");
    expect(parsed.page).toBe(1);
    expect(parsed.pageSize).toBe(10);
    expect(parsed.acquisitionYear).toBeUndefined();
    expect(parsed.categoryId).toBeUndefined();
    expect(parsed.attention).toBe(false);
    expect(parsed.noPhoto).toBe(false);
  });

  it("clamps a negative or zero page back to the first page", () => {
    expect(assetListSearchParamsSchema.parse({ page: "0" }).page).toBe(1);
    expect(assetListSearchParamsSchema.parse({ page: "-3" }).page).toBe(1);
  });

  it("accepts every valid filter and passes it through", () => {
    const parsed = assetListSearchParamsSchema.parse({
      q: "  projector  ",
      categoryId: "cat-1",
      buildingId: "bldg-1",
      roomId: "room-1",
      fundingSourceId: "fund-1",
      status: "in_repair",
      condition: "poor",
      acquisitionYear: "2026",
      attention: "1",
      noPhoto: "1",
      sort: "name",
      dir: "desc",
      page: "2",
      pageSize: "50",
    });

    expect(parsed).toEqual({
      q: "projector",
      categoryId: "cat-1",
      buildingId: "bldg-1",
      roomId: "room-1",
      fundingSourceId: "fund-1",
      status: "in_repair",
      condition: "poor",
      acquisitionYear: 2026,
      attention: true,
      noPhoto: true,
      sort: "name",
      dir: "desc",
      page: 2,
      pageSize: 50,
    });
  });

  it("treats a blank search term as no search", () => {
    expect(assetListSearchParamsSchema.parse({ q: "   " }).q).toBeUndefined();
  });

  it("reads attention=1 as true and anything else as false, never throwing", () => {
    expect(
      assetListSearchParamsSchema.parse({ attention: "1" }).attention,
    ).toBe(true);
    expect(
      assetListSearchParamsSchema.parse({ attention: "0" }).attention,
    ).toBe(false);
    expect(
      assetListSearchParamsSchema.parse({ attention: "true" }).attention,
    ).toBe(false);
    expect(assetListSearchParamsSchema.parse({}).attention).toBe(false);
  });

  it("reads noPhoto=1 as true and anything else as false, never throwing", () => {
    expect(assetListSearchParamsSchema.parse({ noPhoto: "1" }).noPhoto).toBe(
      true,
    );
    expect(assetListSearchParamsSchema.parse({ noPhoto: "0" }).noPhoto).toBe(
      false,
    );
    expect(assetListSearchParamsSchema.parse({ noPhoto: "true" }).noPhoto).toBe(
      false,
    );
    expect(assetListSearchParamsSchema.parse({}).noPhoto).toBe(false);
  });
});
