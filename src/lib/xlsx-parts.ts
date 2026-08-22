import { columnRef, escapeXml, XLSX_STYLE_INDEX } from "./xlsx-cells";

/**
 * The XML documents an `.xlsx` package is made of, minus the rows (issue #14).
 *
 * Six parts is the whole minimum-viable workbook: the content-type map, the
 * package relationships, the workbook, the workbook's relationships, the
 * stylesheet, and the worksheet. Everything the ticket asks for — a frozen
 * styled header, content-sized columns, an IDR number format, real dates — is
 * expressible inside them, which is the reason this is a hundred lines of
 * string templates instead of a dependency.
 */

const XML_DECLARATION =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

const SPREADSHEET_NS =
  "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const RELATIONSHIPS_NS =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const PACKAGE_RELATIONSHIPS_NS =
  "http://schemas.openxmlformats.org/package/2006/relationships";
const CONTENT_TYPES_NS =
  "http://schemas.openxmlformats.org/package/2006/content-types";

export const WORKSHEET_PART_PATH = "xl/worksheets/sheet1.xml";

export const CONTENT_TYPES_XML =
  `${XML_DECLARATION}<Types xmlns="${CONTENT_TYPES_NS}">` +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
  `<Override PartName="/${WORKSHEET_PART_PATH}" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
  '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
  "</Types>";

export const PACKAGE_RELS_XML =
  `${XML_DECLARATION}<Relationships xmlns="${PACKAGE_RELATIONSHIPS_NS}">` +
  `<Relationship Id="rId1" Type="${RELATIONSHIPS_NS}/officeDocument" Target="xl/workbook.xml"/>` +
  "</Relationships>";

export const WORKBOOK_RELS_XML =
  `${XML_DECLARATION}<Relationships xmlns="${PACKAGE_RELATIONSHIPS_NS}">` +
  `<Relationship Id="rId1" Type="${RELATIONSHIPS_NS}/worksheet" Target="worksheets/sheet1.xml"/>` +
  `<Relationship Id="rId2" Type="${RELATIONSHIPS_NS}/styles" Target="styles.xml"/>` +
  "</Relationships>";

/** Excel truncates a sheet name past 31 characters and rejects five
 * punctuation marks outright, so a localised name is trimmed to fit rather
 * than trusted. */
const MAX_SHEET_NAME_LENGTH = 31;
const FORBIDDEN_SHEET_NAME_CHARS = /[[\]:*?/\\]/g;

export function sanitiseSheetName(name: string): string {
  const cleaned = name.replace(FORBIDDEN_SHEET_NAME_CHARS, " ").trim();
  return cleaned.slice(0, MAX_SHEET_NAME_LENGTH);
}

export function workbookXml(sheetName: string): string {
  const name = escapeXml(sanitiseSheetName(sheetName));
  return (
    `${XML_DECLARATION}<workbook xmlns="${SPREADSHEET_NS}" xmlns:r="${RELATIONSHIPS_NS}">` +
    `<sheets><sheet name="${name}" sheetId="1" r:id="rId1"/></sheets>` +
    "</workbook>"
  );
}

/** Built-in format 1 is `0`: an integer with no thousands separator. The
 * acquisition year is a year, not a quantity — `2.026` is the defect this
 * names a constant to avoid. */
const INTEGER_NUM_FMT_ID = 1;
/** Custom formats start at 164 by convention; anything below is reserved. */
const CURRENCY_NUM_FMT_ID = 164;
const DATE_NUM_FMT_ID = 165;

/** `Rp` in the cell *format*, so the stored value stays a plain number. The
 * escaped quotes are the format code's own string delimiters. */
const CURRENCY_FORMAT_CODE = "&quot;Rp&quot;\\ #,##0";
const DATE_FORMAT_CODE = "yyyy\\-mm\\-dd";

const DEFAULT_FONT_ID = 0;
const HEADER_FONT_ID = 1;
const NO_FILL_ID = 0;
const HEADER_FILL_ID = 2;
const DEFAULT_BORDER_ID = 0;
const GENERAL_NUM_FMT_ID = 0;

function cellXf(numFmtId: number, fontId: number, fillId: number): string {
  return (
    `<xf numFmtId="${numFmtId}" fontId="${fontId}" fillId="${fillId}"` +
    ` borderId="${DEFAULT_BORDER_ID}" xfId="0" applyNumberFormat="1"` +
    ' applyFont="1" applyFill="1" applyAlignment="1">' +
    '<alignment vertical="center" wrapText="0"/></xf>'
  );
}

/** The `<xf>` list, in `XLSX_STYLE_INDEX` order — the map in `xlsx-cells.ts`
 * is what cells index into, so the two are built from one shared ordering
 * rather than two lists that can be edited apart. */
const CELL_XFS_BY_STYLE: Readonly<
  Record<keyof typeof XLSX_STYLE_INDEX, string>
> = {
  text: cellXf(GENERAL_NUM_FMT_ID, DEFAULT_FONT_ID, NO_FILL_ID),
  header: cellXf(GENERAL_NUM_FMT_ID, HEADER_FONT_ID, HEADER_FILL_ID),
  integer: cellXf(INTEGER_NUM_FMT_ID, DEFAULT_FONT_ID, NO_FILL_ID),
  currency: cellXf(CURRENCY_NUM_FMT_ID, DEFAULT_FONT_ID, NO_FILL_ID),
  date: cellXf(DATE_NUM_FMT_ID, DEFAULT_FONT_ID, NO_FILL_ID),
};

function cellXfsXml(): string {
  const ordered = Object.entries(XLSX_STYLE_INDEX)
    .sort(([, left], [, right]) => left - right)
    .map(
      ([style]) => CELL_XFS_BY_STYLE[style as keyof typeof XLSX_STYLE_INDEX],
    );
  return `<cellXfs count="${ordered.length}">${ordered.join("")}</cellXfs>`;
}

/** Fill 0 must be `none` and fill 1 must be `gray125`: Excel treats the first
 * two entries as reserved and renders every later index one place out if they
 * are missing. The header fill is therefore index 2. */
const FILLS_XML =
  '<fills count="3">' +
  '<fill><patternFill patternType="none"/></fill>' +
  '<fill><patternFill patternType="gray125"/></fill>' +
  '<fill><patternFill patternType="solid">' +
  '<fgColor rgb="FF1F3864"/><bgColor indexed="64"/>' +
  "</patternFill></fill></fills>";

const FONTS_XML =
  '<fonts count="2">' +
  '<font><sz val="11"/><name val="Calibri"/></font>' +
  '<font><b/><sz val="11"/><name val="Calibri"/><color rgb="FFFFFFFF"/></font>' +
  "</fonts>";

export const STYLES_XML =
  `${XML_DECLARATION}<styleSheet xmlns="${SPREADSHEET_NS}">` +
  '<numFmts count="2">' +
  `<numFmt numFmtId="${CURRENCY_NUM_FMT_ID}" formatCode="${CURRENCY_FORMAT_CODE}"/>` +
  `<numFmt numFmtId="${DATE_NUM_FMT_ID}" formatCode="${DATE_FORMAT_CODE}"/>` +
  "</numFmts>" +
  FONTS_XML +
  FILLS_XML +
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  cellXfsXml() +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  "</styleSheet>";

/** The header occupies row 1, so the frozen split sits below it. */
export const HEADER_ROW_NUMBER = 1;
const FIRST_BODY_CELL = `A${HEADER_ROW_NUMBER + 1}`;

const FROZEN_HEADER_XML =
  "<sheetViews>" +
  '<sheetView workbookViewId="0">' +
  `<pane ySplit="${HEADER_ROW_NUMBER}" topLeftCell="${FIRST_BODY_CELL}"` +
  ' activePane="bottomLeft" state="frozen"/>' +
  `<selection pane="bottomLeft" activeCell="${FIRST_BODY_CELL}" sqref="${FIRST_BODY_CELL}"/>` +
  "</sheetView></sheetViews>";

const DEFAULT_ROW_HEIGHT = 15;

function colsXml(widths: readonly number[]): string {
  const cols = widths
    .map((width, index) => {
      const column = index + 1;
      return `<col min="${column}" max="${column}" width="${width}" customWidth="1"/>`;
    })
    .join("");
  return `<cols>${cols}</cols>`;
}

/** Everything before the first `<row>`. */
export function worksheetPrelude(widths: readonly number[]): string {
  return (
    `${XML_DECLARATION}<worksheet xmlns="${SPREADSHEET_NS}">` +
    FROZEN_HEADER_XML +
    `<sheetFormatPr defaultRowHeight="${DEFAULT_ROW_HEIGHT}"/>` +
    colsXml(widths) +
    "<sheetData>"
  );
}

/** Everything after the last `<row>`. The auto-filter spans the whole used
 * range, so the frozen header doubles as a filter row — `autoFilter` is only
 * legal after `sheetData`, which is why it lives here and not in the
 * prelude. */
export function worksheetEpilogue(
  columnCount: number,
  lastRowNumber: number,
): string {
  const lastColumn = columnRef(columnCount - 1);
  const range = `A${HEADER_ROW_NUMBER}:${lastColumn}${lastRowNumber}`;
  return `</sheetData><autoFilter ref="${range}"/></worksheet>`;
}
