import { describe, expect, it } from "vitest";

import {
  columnRef,
  escapeXml,
  renderCell,
  renderRow,
  toExcelSerialDate,
  XLSX_STYLE_INDEX,
} from "./xlsx-cells";

describe("escapeXml", () => {
  it.each([
    ["&", "&amp;"],
    ["<", "&lt;"],
    [">", "&gt;"],
    ['"', "&quot;"],
    ["'", "&apos;"],
  ])("escapes %s", (raw, escaped) => {
    expect(escapeXml(`a${raw}b`)).toBe(`a${escaped}b`);
  });

  it("drops control characters XML forbids, so one note cannot void the file", () => {
    expect(escapeXml("Ruang \u0000\u0008A")).toBe("Ruang A");
  });

  it("keeps a tab, a newline and non-Latin text intact", () => {
    expect(escapeXml("a\tb\nc — ê")).toBe("a\tb\nc — ê");
  });
});

describe("columnRef", () => {
  it.each([
    [0, "A"],
    [12, "M"],
    [25, "Z"],
    [26, "AA"],
    [27, "AB"],
    [51, "AZ"],
    [52, "BA"],
  ])("renders index %i as %s", (index, ref) => {
    expect(columnRef(index)).toBe(ref);
  });
});

describe("toExcelSerialDate", () => {
  it.each([
    ["1970-01-01T00:00:00.000Z", 25569],
    ["2026-08-22T00:00:00.000Z", 46256],
    ["2030-12-31T00:00:00.000Z", 47848],
  ])("maps %s to serial %i", (iso, serial) => {
    expect(toExcelSerialDate(new Date(iso))).toBe(serial);
  });
});

describe("renderCell", () => {
  it("writes text as an inline string, never as a shared-string index", () => {
    const xml = renderCell("A1", { value: "Proyektor", style: "text" });
    expect(xml).toBe(
      `<c r="A1" s="${XLSX_STYLE_INDEX.text}" t="inlineStr">` +
        '<is><t xml:space="preserve">Proyektor</t></is></c>',
    );
  });

  it("writes a price as a bare number under the currency style", () => {
    const xml = renderCell("N2", { value: 1_500_000, style: "currency" });
    expect(xml).toBe(
      `<c r="N2" s="${XLSX_STYLE_INDEX.currency}"><v>1500000</v></c>`,
    );
    expect(xml).not.toContain("Rp");
    expect(xml).not.toContain("inlineStr");
  });

  it("writes a year as a plain integer with no grouping in the value", () => {
    const xml = renderCell("L2", { value: 2026, style: "integer" });
    expect(xml).toBe(
      `<c r="L2" s="${XLSX_STYLE_INDEX.integer}"><v>2026</v></c>`,
    );
  });

  it("writes a date as its Excel serial under the date style", () => {
    const xml = renderCell("R2", {
      value: new Date("2026-08-22T00:00:00.000Z"),
      style: "date",
    });
    expect(xml).toBe(`<c r="R2" s="${XLSX_STYLE_INDEX.date}"><v>46256</v></c>`);
  });

  it.each([
    ["null", null],
    ["an empty string", ""],
    ["a non-finite number", Number.NaN],
  ])("omits the cell entirely for %s", (_label, value) => {
    expect(renderCell("A2", { value, style: "text" })).toBe("");
  });

  it("escapes the text it writes", () => {
    expect(renderCell("A1", { value: "R&D <lab>", style: "text" })).toContain(
      "R&amp;D &lt;lab&gt;",
    );
  });
});

describe("renderRow", () => {
  it("numbers cells across the row and keeps blanks out of the output", () => {
    const xml = renderRow(3, [
      { value: "A-1", style: "text" },
      { value: null, style: "text" },
      { value: 7, style: "integer" },
    ]);
    expect(xml).toBe(
      '<row r="3">' +
        `<c r="A3" s="${XLSX_STYLE_INDEX.text}" t="inlineStr">` +
        '<is><t xml:space="preserve">A-1</t></is></c>' +
        `<c r="C3" s="${XLSX_STYLE_INDEX.integer}"><v>7</v></c>` +
        "</row>",
    );
  });
});
