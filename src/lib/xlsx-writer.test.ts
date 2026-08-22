import { inflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";

import { XLSX_STYLE_INDEX, type XlsxCell } from "./xlsx-cells";
import { WORKSHEET_PART_PATH } from "./xlsx-parts";
import {
  collectStream,
  createXlsxStream,
  type XlsxColumn,
} from "./xlsx-writer";

/**
 * These tests read the produced bytes back. A workbook that type-checks and a
 * workbook Excel can open are different claims, and only the second one is
 * worth anything to the person clicking "export" — so the archive is unzipped
 * here and its worksheet XML asserted, rather than the string that went in.
 */

const LOCAL_HEADER_SIGNATURE = 0x04034b50;
const COMPRESSED_SIZE_OFFSET = 18;
const NAME_LENGTH_OFFSET = 26;
const EXTRA_LENGTH_OFFSET = 28;
const LOCAL_HEADER_SIZE = 30;

/** This is a 5000-row compression benchmark, not a speed check. Standalone it
 * finishes in well under a second (measured 817 ms), but Vitest's default
 * 5000 ms per-test timeout leaves no margin under parallel test load, so it
 * gets a generous timeout of its own instead of racing the whole suite. */
const LARGE_EXPORT_TEST_TIMEOUT_MS = 20_000;

/** Walks the local file headers in order, which is enough to read an archive
 * this writer produced: every entry stores its own compressed size. */
function readArchive(archive: Buffer): ReadonlyMap<string, string> {
  const entries = new Map<string, string>();
  let offset = 0;
  while (
    offset + LOCAL_HEADER_SIZE <= archive.length &&
    archive.readUInt32LE(offset) === LOCAL_HEADER_SIGNATURE
  ) {
    const compressedSize = archive.readUInt32LE(
      offset + COMPRESSED_SIZE_OFFSET,
    );
    const nameLength = archive.readUInt16LE(offset + NAME_LENGTH_OFFSET);
    const extraLength = archive.readUInt16LE(offset + EXTRA_LENGTH_OFFSET);
    const nameAt = offset + LOCAL_HEADER_SIZE;
    const dataAt = nameAt + nameLength + extraLength;
    const name = archive
      .subarray(nameAt, dataAt - extraLength)
      .toString("utf8");
    const data = archive.subarray(dataAt, dataAt + compressedSize);
    entries.set(name, inflateRawSync(data).toString("utf8"));
    offset = dataAt + compressedSize;
  }
  return entries;
}

const COLUMNS: readonly XlsxColumn[] = [
  { header: "Kode aset", width: 14 },
  { header: "Harga perolehan", width: 18 },
  { header: "Garansi sampai", width: 14 },
];

function bodyRow(code: string, price: number): readonly XlsxCell[] {
  return [
    { value: code, style: "text" },
    { value: price, style: "currency" },
    { value: new Date("2027-01-31T00:00:00.000Z"), style: "date" },
  ];
}

async function* rowsOf(
  rows: readonly (readonly XlsxCell[])[],
): AsyncGenerator<readonly XlsxCell[]> {
  for (const row of rows) {
    yield row;
  }
}

async function buildWorkbook(
  rows: readonly (readonly XlsxCell[])[],
): Promise<ReadonlyMap<string, string>> {
  const stream = createXlsxStream({
    sheetName: "Aset",
    columns: COLUMNS,
    rows: rowsOf(rows),
  });
  return readArchive(await collectStream(stream));
}

describe("createXlsxStream", () => {
  it("produces the six parts an xlsx package needs", async () => {
    const archive = await buildWorkbook([bodyRow("PPM-1", 1_500_000)]);

    expect([...archive.keys()]).toEqual([
      "[Content_Types].xml",
      "_rels/.rels",
      "xl/workbook.xml",
      "xl/_rels/workbook.xml.rels",
      "xl/styles.xml",
      WORKSHEET_PART_PATH,
    ]);
  });

  it("freezes the header row and sizes the columns", async () => {
    const archive = await buildWorkbook([bodyRow("PPM-1", 1_500_000)]);
    const sheet = archive.get(WORKSHEET_PART_PATH) ?? "";

    expect(sheet).toContain('state="frozen"');
    expect(sheet).toContain(
      '<col min="1" max="1" width="14" customWidth="1"/>',
    );
    expect(sheet).toContain('<autoFilter ref="A1:C2"/>');
  });

  it("styles the header row and localises its text", async () => {
    const archive = await buildWorkbook([]);
    const sheet = archive.get(WORKSHEET_PART_PATH) ?? "";

    expect(sheet).toContain(`<c r="A1" s="${XLSX_STYLE_INDEX.header}"`);
    expect(sheet).toContain("Harga perolehan");
  });

  it("writes a price as a number carrying the IDR cell format, never as text", async () => {
    const archive = await buildWorkbook([bodyRow("PPM-1", 1_500_000)]);
    const sheet = archive.get(WORKSHEET_PART_PATH) ?? "";
    const styles = archive.get("xl/styles.xml") ?? "";

    expect(sheet).toContain(
      `<c r="B2" s="${XLSX_STYLE_INDEX.currency}"><v>1500000</v></c>`,
    );
    expect(sheet).not.toContain("Rp");
    expect(styles).toContain("&quot;Rp&quot;\\ #,##0");
  });

  it("writes a warranty date as an Excel serial under the date format", async () => {
    const archive = await buildWorkbook([bodyRow("PPM-1", 1)]);
    const sheet = archive.get(WORKSHEET_PART_PATH) ?? "";

    expect(sheet).toContain(
      `<c r="C2" s="${XLSX_STYLE_INDEX.date}"><v>46418</v></c>`,
    );
  });

  it("numbers body rows from two, leaving row one to the header", async () => {
    const rows = [
      bodyRow("PPM-1", 1),
      bodyRow("PPM-2", 2),
      bodyRow("PPM-3", 3),
    ];
    const sheet = (await buildWorkbook(rows)).get(WORKSHEET_PART_PATH) ?? "";

    expect(sheet).toContain('<row r="2">');
    expect(sheet).toContain('<row r="4">');
    expect(sheet).toContain('<autoFilter ref="A1:C4"/>');
  });

  it("still produces a valid workbook when the filters match nothing", async () => {
    const sheet = (await buildWorkbook([])).get(WORKSHEET_PART_PATH) ?? "";

    expect(sheet).toContain("<sheetData>");
    expect(sheet).toContain('<autoFilter ref="A1:C1"/>');
    expect(sheet.endsWith("</worksheet>")).toBe(true);
  });

  it("names the sheet from the localised name it is given", async () => {
    const archive = await buildWorkbook([]);
    expect(archive.get("xl/workbook.xml")).toContain('name="Aset"');
  });
});

describe("createXlsxStream memory behaviour", () => {
  it(
    "keeps a large export far smaller compressed than the XML it wrote",
    async () => {
      const rows = Array.from({ length: 5000 }, (_unused, index) =>
        bodyRow(`PPM-${index}`, index * 1000),
      );
      const stream = createXlsxStream({
        sheetName: "Aset",
        columns: COLUMNS,
        rows: rowsOf(rows),
      });
      const bytes = await collectStream(stream);
      const sheet = readArchive(bytes).get(WORKSHEET_PART_PATH) ?? "";

      expect(sheet).toContain('<row r="5001">');
      expect(bytes.length).toBeLessThan(sheet.length / 5);
    },
    LARGE_EXPORT_TEST_TIMEOUT_MS,
  );

  it("produces nothing until the body is read", async () => {
    let started = false;
    async function* watched(): AsyncGenerator<readonly XlsxCell[]> {
      started = true;
      yield bodyRow("PPM-1", 1);
    }

    const stream = createXlsxStream({
      sheetName: "Aset",
      columns: COLUMNS,
      rows: watched(),
    });
    expect(started).toBe(false);

    await collectStream(stream);
    expect(started).toBe(true);
  });
});
