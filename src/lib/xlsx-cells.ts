/**
 * Cell-level SpreadsheetML: escaping, column references, the Excel date
 * serial, and the `<c>`/`<row>` elements themselves (issue #14).
 *
 * Two decisions here are worth stating, because both are what make "numbers
 * export as numbers and dates as dates" true rather than merely intended:
 *
 * - A value is written as `<v>` with a *style* that carries the number format.
 *   Nothing is ever pre-formatted into a string, so `1500000` opens as the
 *   number one and a half million displayed as `Rp 1.500.000`, and stays a
 *   number when the recipient sums the column. Baking `"Rp 1.500.000"` into a
 *   text cell is the failure this ticket exists to avoid, and a CSV cannot
 *   avoid it at all.
 * - Text uses `t="inlineStr"` rather than the shared-string table. A shared
 *   string table has to be complete before it is written, which means holding
 *   every distinct string of the export in memory — the opposite of streaming.
 *   Inline strings cost some bytes and buy a constant memory profile.
 */

/** The order of `<xf>` entries in `xl/styles.xml`. `xlsx-parts.ts` builds that
 * element from this same map, so an index can never drift from the format it
 * is supposed to name. */
export const XLSX_STYLE_INDEX = {
  text: 0,
  header: 1,
  integer: 2,
  currency: 3,
  date: 4,
} as const;

export type XlsxStyleName = keyof typeof XLSX_STYLE_INDEX;

export type XlsxCellValue = string | number | Date | null;

export interface XlsxCell {
  readonly value: XlsxCellValue;
  readonly style: XlsxStyleName;
}

const XML_ESCAPES: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

/** Control characters XML 1.0 forbids outright. A note field pasted out of
 * another system can carry them, and Excel rejects the whole workbook rather
 * than the one cell, so they are dropped rather than escaped. Both patterns
 * are plain character classes with no alternation and no quantified group —
 * there is no backtracking surface (S5852, S8786). */
const ILLEGAL_XML_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;
const ESCAPED_XML_CHARS = /[&<>"']/g;

export function escapeXml(value: string): string {
  return value
    .replace(ILLEGAL_XML_CHARS, "")
    .replace(ESCAPED_XML_CHARS, (char) => XML_ESCAPES[char] ?? char);
}

const ALPHABET_SIZE = 26;
const FIRST_COLUMN_LETTER_CODE = 65;

/** `0` → `A`, `25` → `Z`, `26` → `AA`. Excel's column names are bijective
 * base-26, not plain base-26, which is what the `- 1` accounts for. */
export function columnRef(index: number): string {
  let ref = "";
  let remaining = index;
  while (remaining >= 0) {
    const letter = String.fromCharCode(
      FIRST_COLUMN_LETTER_CODE + (remaining % ALPHABET_SIZE),
    );
    ref = letter + ref;
    remaining = Math.floor(remaining / ALPHABET_SIZE) - 1;
  }
  return ref;
}

const MILLISECONDS_PER_DAY = 86_400_000;
/** 1970-01-01 is serial 25569 on Excel's 1900 date system. */
const EXCEL_EPOCH_OFFSET_DAYS = 25_569;

/** A `Date` as the number Excel stores a date as. The cell's style supplies
 * the date number format; this only supplies the value, which is what makes
 * the result sortable and subtractable in the spreadsheet. */
export function toExcelSerialDate(date: Date): number {
  return date.getTime() / MILLISECONDS_PER_DAY + EXCEL_EPOCH_OFFSET_DAYS;
}

function inlineStringCell(ref: string, style: number, value: string): string {
  return (
    `<c r="${ref}" s="${style}" t="inlineStr">` +
    `<is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`
  );
}

function numberCell(ref: string, style: number, value: number): string {
  return `<c r="${ref}" s="${style}"><v>${value}</v></c>`;
}

/** One `<c>` element, or the empty string for a blank. An omitted cell is
 * what a spreadsheet means by empty; writing `<c/>` with a style would make
 * the column look populated to `COUNTA` and to a filter. */
export function renderCell(ref: string, cell: XlsxCell): string {
  const style = XLSX_STYLE_INDEX[cell.style];
  const { value } = cell;
  if (value === null || value === "") {
    return "";
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? numberCell(ref, style, value) : "";
  }
  if (value instanceof Date) {
    return numberCell(ref, style, toExcelSerialDate(value));
  }
  return inlineStringCell(ref, style, value);
}

/** One `<row>`. `rowNumber` is one-based, as the format requires. */
export function renderRow(
  rowNumber: number,
  cells: readonly XlsxCell[],
): string {
  const rendered = cells
    .map((cell, index) => renderCell(`${columnRef(index)}${rowNumber}`, cell))
    .join("");
  return `<row r="${rowNumber}">${rendered}</row>`;
}
