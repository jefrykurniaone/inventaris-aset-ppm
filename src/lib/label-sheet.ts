/**
 * The bulk label sheet's single layout configuration (PRD FR-5.4: "Layout is
 * driven by CSS `@page` rules and a single configuration constant, so an
 * alternative label stock is a one-line change"). Every dimension the print
 * CSS below emits — grid cell size, column and row counts, page margins — is
 * derived from `LABEL_SHEET`, so switching label stock means editing the
 * values in this one object and nothing else.
 *
 * Default: 63.5 x 38.1 mm, 3 columns x 7 rows on A4 (21 labels per sheet) —
 * the stock named in the PRD and issue #12. A documented alternative sits
 * commented out immediately below the export.
 */

/** A4 in millimetres. Not itself a `LABEL_SHEET` field: every preset this
 * project is expected to print on is A4, so the page size is a fact about
 * the printer, not about the label stock. */
export const A4_WIDTH_MM = 210;
export const A4_HEIGHT_MM = 297;

export interface LabelSheetSpec {
  readonly labelWidthMm: number;
  readonly labelHeightMm: number;
  readonly columns: number;
  readonly rows: number;
  readonly columnGapMm: number;
  readonly rowGapMm: number;
}

export const LABEL_SHEET: LabelSheetSpec = {
  labelWidthMm: 63.5,
  labelHeightMm: 38.1,
  columns: 3,
  rows: 7,
  columnGapMm: 0,
  rowGapMm: 0,
};

// Alternative preset: 38 x 21 mm labels, 3 columns x 10 rows on A4 (30 per
// sheet). Swap this in for the `LABEL_SHEET` export above to change stock —
// `LABELS_PER_SHEET`, `computeSheetMargins` and `buildLabelSheetCss` below
// all re-derive from it; nothing else in the label print view needs to
// change.
// export const LABEL_SHEET: LabelSheetSpec = {
//   labelWidthMm: 38,
//   labelHeightMm: 21,
//   columns: 3,
//   rows: 10,
//   columnGapMm: 0,
//   rowGapMm: 0,
// };

/** How many label positions one sheet holds — the pagination boundary
 * `src/lib/label-pagination.ts` chunks against. */
export const LABELS_PER_SHEET = LABEL_SHEET.columns * LABEL_SHEET.rows;

export interface LabelSheetMargins {
  readonly marginTopMm: number;
  readonly marginLeftMm: number;
}

/**
 * Centers the label grid on an A4 page. Derived from `sheet` rather than
 * hand-entered so the margins can never drift out of step with the label
 * size, column count and row count they depend on.
 */
export function computeSheetMargins(
  sheet: LabelSheetSpec = LABEL_SHEET,
): LabelSheetMargins {
  const gridWidthMm =
    sheet.columns * sheet.labelWidthMm +
    (sheet.columns - 1) * sheet.columnGapMm;
  const gridHeightMm =
    sheet.rows * sheet.labelHeightMm + (sheet.rows - 1) * sheet.rowGapMm;

  return {
    marginLeftMm: (A4_WIDTH_MM - gridWidthMm) / 2,
    marginTopMm: (A4_HEIGHT_MM - gridHeightMm) / 2,
  };
}

function mm(value: number): string {
  return `${value}mm`;
}

/** CSS reference pixels per millimetre (96 px/in ÷ 25.4 mm/in), so the QR
 * code's `sizePx` prop — a pixel count, per `QrCode.tsx` — can be derived from
 * a physical size instead of a hand-picked pixel constant. */
const PX_PER_MM = 96 / 25.4;

/** The QR code fills this fraction of the label's shorter side, leaving room
 * for the asset code, the truncated name and the organisation line below it. */
const LABEL_QR_SIZE_FRACTION = 0.6;

/**
 * The QR code's rendered size for one label, in the CSS pixels `QrCode`
 * expects, derived from `sheet` so a smaller label preset (see the 38 x
 * 21 mm alternative above) prints a proportionally smaller code rather than
 * one that no longer fits.
 */
export function computeLabelQrSizePx(
  sheet: LabelSheetSpec = LABEL_SHEET,
): number {
  const shorterSideMm = Math.min(sheet.labelWidthMm, sheet.labelHeightMm);
  return Math.round(shorterSideMm * LABEL_QR_SIZE_FRACTION * PX_PER_MM);
}

/** Screen-only preview chrome: a dashed outline around each sheet and a
 * dotted one around each cell, so the on-screen preview reads as a page
 * before it is printed. Neither rule applies under `@media print`, so it
 * never reaches paper. */
const PREVIEW_SHEET_BORDER = "1px dashed #999999";
const PREVIEW_CELL_BORDER = "1px dotted #cccccc";
const PREVIEW_SHEET_GAP_MM = 8;
const LABEL_CELL_PADDING_MM = 2;

/**
 * The print stylesheet, generated from `sheet` rather than written by hand —
 * the guarantee this module exists to keep is that every CSS dimension
 * traces back to `LABEL_SHEET`. Built as a plain string of numbers and unit
 * suffixes, never from request or database input, so `LabelSheetStyle.tsx`
 * can render it as a literal `<style>` child with no
 * `dangerouslySetInnerHTML` — the same reasoning `src/components/QrCode.tsx`
 * gives for building its own markup as elements rather than a string handed
 * to an escape hatch.
 */
export function buildLabelSheetCss(
  sheet: LabelSheetSpec = LABEL_SHEET,
): string {
  const margins = computeSheetMargins(sheet);

  return `
@page {
  size: A4;
  margin: 0;
}

.label-sheet-page {
  box-sizing: border-box;
  width: ${mm(A4_WIDTH_MM)};
  height: ${mm(A4_HEIGHT_MM)};
  padding: ${mm(margins.marginTopMm)} ${mm(margins.marginLeftMm)};
  display: grid;
  grid-template-columns: repeat(${sheet.columns}, ${mm(sheet.labelWidthMm)});
  grid-template-rows: repeat(${sheet.rows}, ${mm(sheet.labelHeightMm)});
  column-gap: ${mm(sheet.columnGapMm)};
  row-gap: ${mm(sheet.rowGapMm)};
  /* Black on white regardless of the app's light/dark theme, same reasoning
     as the literal colours in QrCode.tsx: a printed label has no theme, and a
     dark-mode foreground colour would print invisible on white paper. */
  background: #ffffff;
  color: #000000;
}

.label-sheet-page + .label-sheet-page {
  break-before: page;
}

.label-cell {
  box-sizing: border-box;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 1mm;
  padding: ${mm(LABEL_CELL_PADDING_MM)};
}

@media screen {
  .label-sheet-page {
    border: ${PREVIEW_SHEET_BORDER};
    margin-bottom: ${mm(PREVIEW_SHEET_GAP_MM)};
  }

  .label-cell {
    border: ${PREVIEW_CELL_BORDER};
  }
}
`;
}
