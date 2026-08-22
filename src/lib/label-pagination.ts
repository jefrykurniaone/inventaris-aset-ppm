import { LABELS_PER_SHEET } from "@/lib/label-sheet";

/**
 * Pure pagination math for the bulk label sheet (PRD FR-5.4, FR-5.5): how a
 * flat list of asset ids, plus an optional starting offset, breaks into pages
 * of `LABELS_PER_SHEET` positions each. Kept apart from the page component
 * for the same reason `asset-list-query.ts` is split from `queries.ts`: a
 * plain function with unit tests beside it is what "pagination and offset are
 * correct" can actually be checked against, rather than trusted from reading
 * JSX.
 */

/** The offset can skip at most one sheet's worth of already-used positions —
 * beyond that, the first sheet requested would be entirely blank, which is
 * never useful and would silently swallow a print run. */
export const MAX_LABEL_OFFSET = LABELS_PER_SHEET - 1;

const MIN_LABEL_OFFSET = 0;

/** Whether `offset` is a value `buildLabelPositions` accepts. Exported so the
 * route's search-param schema (`src/app/(app)/assets/labels/schemas.ts`) can
 * enforce the same bound it validates against, rather than a second copy of
 * `0` and `MAX_LABEL_OFFSET`. */
export function isValidLabelOffset(offset: number): boolean {
  return (
    Number.isInteger(offset) &&
    offset >= MIN_LABEL_OFFSET &&
    offset <= MAX_LABEL_OFFSET
  );
}

/** One sheet position: an asset id to print there, or `null` for a position
 * left blank by the starting offset — an already-used spot on a partly used
 * sheet (FR-5.4's offset control). */
export type LabelPosition = string | null;

/** Leading `null`s for `offset`, followed by every requested id, in order. */
export function buildLabelPositions(
  ids: readonly string[],
  offset: number,
): readonly LabelPosition[] {
  const blanks: readonly LabelPosition[] = Array.from(
    { length: offset },
    () => null,
  );
  return [...blanks, ...ids];
}

export interface LabelSheetPage {
  /** One-based, for display ("Sheet 1 of 2") rather than array indexing. */
  readonly pageNumber: number;
  readonly positions: readonly LabelPosition[];
}

/**
 * Breaks `positions` into pages of `LABELS_PER_SHEET`. The final page is
 * short rather than padded with more blanks: nothing is printed on positions
 * past the last requested label. Zero positions returns zero pages — no
 * selection means no sheet, not one blank sheet.
 */
export function chunkLabelPositions(
  positions: readonly LabelPosition[],
): readonly LabelSheetPage[] {
  const pages: LabelSheetPage[] = [];
  for (let start = 0; start < positions.length; start += LABELS_PER_SHEET) {
    pages.push({
      pageNumber: pages.length + 1,
      positions: positions.slice(start, start + LABELS_PER_SHEET),
    });
  }
  return pages;
}

/**
 * The end-to-end pure step the label print view calls: ids and an offset in,
 * paginated sheets out. No ids means no sheets regardless of `offset` — an
 * offset only ever means something relative to labels that are actually
 * being printed, so a page of nothing but blanks is never produced.
 */
export function buildLabelSheets(
  ids: readonly string[],
  offset: number,
): readonly LabelSheetPage[] {
  if (ids.length === 0) {
    return [];
  }
  return chunkLabelPositions(buildLabelPositions(ids, offset));
}
