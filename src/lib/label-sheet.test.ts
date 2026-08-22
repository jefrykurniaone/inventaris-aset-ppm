import { describe, expect, it } from "vitest";

import {
  A4_HEIGHT_MM,
  A4_WIDTH_MM,
  buildLabelSheetCss,
  computeLabelQrSizePx,
  computeSheetMargins,
  LABEL_SHEET,
  LABELS_PER_SHEET,
  type LabelSheetSpec,
} from "./label-sheet";

describe("LABEL_SHEET", () => {
  it("defaults to 63.5 x 38.1 mm, 3 columns x 7 rows (PRD FR-5.4)", () => {
    expect(LABEL_SHEET).toEqual({
      labelWidthMm: 63.5,
      labelHeightMm: 38.1,
      columns: 3,
      rows: 7,
      columnGapMm: 0,
      rowGapMm: 0,
    });
  });

  it("derives 21 labels per sheet", () => {
    expect(LABELS_PER_SHEET).toBe(21);
  });
});

describe("computeSheetMargins", () => {
  it("centers the default sheet on A4", () => {
    const margins = computeSheetMargins(LABEL_SHEET);
    expect(margins.marginLeftMm).toBeCloseTo((210 - 3 * 63.5) / 2);
    expect(margins.marginTopMm).toBeCloseTo((297 - 7 * 38.1) / 2);
  });

  it("accounts for gaps between labels", () => {
    const sheet: LabelSheetSpec = {
      labelWidthMm: 50,
      labelHeightMm: 30,
      columns: 2,
      rows: 2,
      columnGapMm: 5,
      rowGapMm: 4,
    };
    const margins = computeSheetMargins(sheet);
    // gridWidth = 2*50 + 1*5 = 105; gridHeight = 2*30 + 1*4 = 64
    expect(margins.marginLeftMm).toBeCloseTo((A4_WIDTH_MM - 105) / 2);
    expect(margins.marginTopMm).toBeCloseTo((A4_HEIGHT_MM - 64) / 2);
  });

  it("defaults to LABEL_SHEET when called with no argument", () => {
    expect(computeSheetMargins()).toEqual(computeSheetMargins(LABEL_SHEET));
  });
});

describe("buildLabelSheetCss", () => {
  it("sets the page size to A4 with no browser margin", () => {
    const css = buildLabelSheetCss(LABEL_SHEET);
    expect(css).toContain("size: A4;");
    expect(css).toContain("margin: 0;");
  });

  it("derives the grid template from the sheet's own dimensions", () => {
    const css = buildLabelSheetCss(LABEL_SHEET);
    expect(css).toContain("grid-template-columns: repeat(3, 63.5mm);");
    expect(css).toContain("grid-template-rows: repeat(7, 38.1mm);");
  });

  it("re-derives every dimension when the sheet changes", () => {
    const altSheet: LabelSheetSpec = {
      labelWidthMm: 38,
      labelHeightMm: 21,
      columns: 3,
      rows: 10,
      columnGapMm: 0,
      rowGapMm: 0,
    };
    const css = buildLabelSheetCss(altSheet);
    expect(css).toContain("grid-template-columns: repeat(3, 38mm);");
    expect(css).toContain("grid-template-rows: repeat(10, 21mm);");
    expect(css).not.toContain("63.5mm");
  });

  it("breaks before every sheet after the first, not the first itself", () => {
    const css = buildLabelSheetCss(LABEL_SHEET);
    expect(css).toContain(".label-sheet-page + .label-sheet-page");
    expect(css).toContain("break-before: page;");
  });

  it("defaults to LABEL_SHEET when called with no argument", () => {
    expect(buildLabelSheetCss()).toBe(buildLabelSheetCss(LABEL_SHEET));
  });

  it("forces black on white, independent of the app theme", () => {
    const css = buildLabelSheetCss(LABEL_SHEET);
    expect(css).toContain("background: #ffffff;");
    expect(css).toContain("color: #000000;");
  });
});

describe("computeLabelQrSizePx", () => {
  it("scales with the label's shorter side", () => {
    const defaultSize = computeLabelQrSizePx(LABEL_SHEET);
    const smallerSheet: LabelSheetSpec = {
      labelWidthMm: 38,
      labelHeightMm: 21,
      columns: 3,
      rows: 10,
      columnGapMm: 0,
      rowGapMm: 0,
    };
    expect(computeLabelQrSizePx(smallerSheet)).toBeLessThan(defaultSize);
  });

  it("returns a positive integer pixel count", () => {
    const size = computeLabelQrSizePx(LABEL_SHEET);
    expect(Number.isInteger(size)).toBe(true);
    expect(size).toBeGreaterThan(0);
  });

  it("defaults to LABEL_SHEET when called with no argument", () => {
    expect(computeLabelQrSizePx()).toBe(computeLabelQrSizePx(LABEL_SHEET));
  });
});
