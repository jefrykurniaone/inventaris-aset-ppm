import { describe, expect, it } from "vitest";

import { XLSX_STYLE_INDEX } from "./xlsx-cells";
import {
  CONTENT_TYPES_XML,
  HEADER_ROW_NUMBER,
  PACKAGE_RELS_XML,
  sanitiseSheetName,
  STYLES_XML,
  WORKBOOK_RELS_XML,
  workbookXml,
  worksheetEpilogue,
  worksheetPrelude,
  WORKSHEET_PART_PATH,
} from "./xlsx-parts";

describe("sanitiseSheetName", () => {
  it.each([
    ["Assets", "Assets"],
    ["Aset/Inventaris", "Aset Inventaris"],
    ["a[b]c:d*e?f", "a b c d e f"],
  ])("turns %s into %s", (raw, expected) => {
    expect(sanitiseSheetName(raw)).toBe(expected);
  });

  it("trims to the 31 characters Excel accepts", () => {
    expect(sanitiseSheetName("A".repeat(40))).toHaveLength(31);
  });
});

describe("workbookXml", () => {
  it("names the single sheet and escapes the name", () => {
    expect(workbookXml("R&D")).toContain('name="R&amp;D"');
  });
});

describe("the fixed package parts", () => {
  it("declares a content type for every part the workbook references", () => {
    expect(CONTENT_TYPES_XML).toContain(`/${WORKSHEET_PART_PATH}`);
    expect(CONTENT_TYPES_XML).toContain("/xl/styles.xml");
    expect(CONTENT_TYPES_XML).toContain("/xl/workbook.xml");
  });

  it("relates the package to the workbook and the workbook to its parts", () => {
    expect(PACKAGE_RELS_XML).toContain('Target="xl/workbook.xml"');
    expect(WORKBOOK_RELS_XML).toContain('Target="worksheets/sheet1.xml"');
    expect(WORKBOOK_RELS_XML).toContain('Target="styles.xml"');
  });
});

describe("STYLES_XML", () => {
  it("puts the IDR symbol in a number format, not in any cell value", () => {
    expect(STYLES_XML).toContain("&quot;Rp&quot;\\ #,##0");
  });

  it("formats dates as a date rather than as a serial number", () => {
    expect(STYLES_XML).toContain("yyyy\\-mm\\-dd");
  });

  it("declares one cell format per style name, in index order", () => {
    const count = Object.keys(XLSX_STYLE_INDEX).length;
    expect(STYLES_XML).toContain(`<cellXfs count="${count}">`);
  });

  it("reserves Excel's first two fills so the header fill keeps its index", () => {
    const noneAt = STYLES_XML.indexOf('patternType="none"');
    const grayAt = STYLES_XML.indexOf('patternType="gray125"');
    const solidAt = STYLES_XML.indexOf('patternType="solid"');
    expect(noneAt).toBeLessThan(grayAt);
    expect(grayAt).toBeLessThan(solidAt);
  });
});

describe("worksheetPrelude", () => {
  it("freezes the pane below the header row", () => {
    const xml = worksheetPrelude([10, 20]);
    expect(xml).toContain(
      `<pane ySplit="${HEADER_ROW_NUMBER}" topLeftCell="A2"` +
        ' activePane="bottomLeft" state="frozen"/>',
    );
  });

  it("writes one sized column per width, one-based", () => {
    const xml = worksheetPrelude([12, 34]);
    expect(xml).toContain('<col min="1" max="1" width="12" customWidth="1"/>');
    expect(xml).toContain('<col min="2" max="2" width="34" customWidth="1"/>');
  });

  it("opens sheetData last, so rows can follow immediately", () => {
    expect(worksheetPrelude([10]).endsWith("<sheetData>")).toBe(true);
  });
});

describe("worksheetEpilogue", () => {
  it("filters the whole used range, after sheetData as the schema requires", () => {
    expect(worksheetEpilogue(13, 42)).toBe(
      '</sheetData><autoFilter ref="A1:M42"/></worksheet>',
    );
  });

  it("still closes correctly for an export with no rows", () => {
    expect(worksheetEpilogue(13, HEADER_ROW_NUMBER)).toContain('ref="A1:M1"');
  });
});
