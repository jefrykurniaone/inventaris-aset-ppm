import { describe, expect, it } from "vitest";

import {
  buildLabelPositions,
  buildLabelSheets,
  chunkLabelPositions,
  isValidLabelOffset,
  MAX_LABEL_OFFSET,
} from "./label-pagination";

describe("isValidLabelOffset", () => {
  it("accepts 0 and the maximum", () => {
    expect(isValidLabelOffset(0)).toBe(true);
    expect(isValidLabelOffset(MAX_LABEL_OFFSET)).toBe(true);
  });

  it("rejects negative, fractional, and out-of-range values", () => {
    expect(isValidLabelOffset(-1)).toBe(false);
    expect(isValidLabelOffset(1.5)).toBe(false);
    expect(isValidLabelOffset(MAX_LABEL_OFFSET + 1)).toBe(false);
  });
});

describe("buildLabelPositions", () => {
  it("returns the ids unchanged at offset 0", () => {
    expect(buildLabelPositions(["a", "b"], 0)).toEqual(["a", "b"]);
  });

  it("prepends the requested number of blank positions", () => {
    expect(buildLabelPositions(["a", "b"], 3)).toEqual([
      null,
      null,
      null,
      "a",
      "b",
    ]);
  });

  it("returns only blanks when there are no ids", () => {
    expect(buildLabelPositions([], 2)).toEqual([null, null]);
  });
});

describe("chunkLabelPositions", () => {
  it("returns no pages for an empty selection", () => {
    expect(chunkLabelPositions([])).toEqual([]);
  });

  it("fits exactly one full sheet without a second, empty page", () => {
    const positions = Array.from({ length: 21 }, (_, i) => `id-${i}`);
    const pages = chunkLabelPositions(positions);
    expect(pages).toHaveLength(1);
    expect(pages[0]).toEqual({ pageNumber: 1, positions });
  });

  it("carries the 22nd label onto a second, short page", () => {
    const positions = Array.from({ length: 22 }, (_, i) => `id-${i}`);
    const pages = chunkLabelPositions(positions);
    expect(pages).toHaveLength(2);
    expect(pages[0].positions).toHaveLength(21);
    expect(pages[1]).toEqual({ pageNumber: 2, positions: ["id-21"] });
  });

  it("numbers pages sequentially from 1", () => {
    const positions = Array.from({ length: 45 }, (_, i) => `id-${i}`);
    const pages = chunkLabelPositions(positions);
    expect(pages.map((page) => page.pageNumber)).toEqual([1, 2, 3]);
  });
});

describe("buildLabelSheets", () => {
  it("combines the offset and the pagination in one call", () => {
    const ids = Array.from({ length: 25 }, (_, i) => `id-${i}`);
    const pages = buildLabelSheets(ids, 2);

    expect(pages).toHaveLength(2);
    expect(pages[0].positions).toHaveLength(21);
    expect(pages[0].positions.slice(0, 2)).toEqual([null, null]);
    expect(pages[0].positions[2]).toBe("id-0");
    expect(pages[1].positions).toEqual([
      "id-19",
      "id-20",
      "id-21",
      "id-22",
      "id-23",
      "id-24",
    ]);
  });

  it("returns no sheets for an empty selection at any offset", () => {
    expect(buildLabelSheets([], 5)).toEqual([]);
  });
});
