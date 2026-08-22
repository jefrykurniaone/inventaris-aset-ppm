import { describe, expect, it } from "vitest";

import { labelsSearchParamsSchema, MAX_LABEL_OFFSET } from "./schemas";

describe("labelsSearchParamsSchema", () => {
  it("defaults to an empty selection and no offset when the params are empty", () => {
    expect(labelsSearchParamsSchema.parse({})).toEqual({
      ids: [],
      offset: 0,
    });
  });

  it("splits a comma-separated ids param, trimming each id", () => {
    const parsed = labelsSearchParamsSchema.parse({
      ids: " asset-1 , asset-2,asset-3 ",
    });
    expect(parsed.ids).toEqual(["asset-1", "asset-2", "asset-3"]);
  });

  it("drops empty entries from the ids list", () => {
    const parsed = labelsSearchParamsSchema.parse({ ids: "asset-1,,asset-2" });
    expect(parsed.ids).toEqual(["asset-1", "asset-2"]);
  });

  it("falls back to no ids for a repeated query param instead of throwing", () => {
    expect(() =>
      labelsSearchParamsSchema.parse({ ids: ["a", "b"] }),
    ).not.toThrow();
    expect(labelsSearchParamsSchema.parse({ ids: ["a", "b"] }).ids).toEqual([]);
  });

  it("accepts an in-range integer offset", () => {
    expect(labelsSearchParamsSchema.parse({ offset: "5" }).offset).toBe(5);
    expect(
      labelsSearchParamsSchema.parse({ offset: String(MAX_LABEL_OFFSET) })
        .offset,
    ).toBe(MAX_LABEL_OFFSET);
  });

  it("falls back to 0 for a negative, fractional, or out-of-range offset", () => {
    expect(labelsSearchParamsSchema.parse({ offset: "-1" }).offset).toBe(0);
    expect(labelsSearchParamsSchema.parse({ offset: "1.5" }).offset).toBe(0);
    expect(
      labelsSearchParamsSchema.parse({
        offset: String(MAX_LABEL_OFFSET + 1),
      }).offset,
    ).toBe(0);
  });

  it("falls back to 0 for a non-numeric offset instead of throwing", () => {
    expect(() =>
      labelsSearchParamsSchema.parse({ offset: "not-a-number" }),
    ).not.toThrow();
    expect(
      labelsSearchParamsSchema.parse({ offset: "not-a-number" }).offset,
    ).toBe(0);
  });
});
