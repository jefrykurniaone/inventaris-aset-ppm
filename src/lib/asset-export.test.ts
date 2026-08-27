import { describe, expect, it } from "vitest";

import {
  ASSET_EXPORT_CHUNK_SIZE,
  assetExportDateStamp,
  assetExportFileName,
  buildAssetExportHref,
  isAssetExportTooLarge,
  MAX_ASSET_EXPORT_ROWS,
  measureColumnWidths,
  toAssetExportCells,
  toDecimalNumber,
  type AssetExportLabels,
  type AssetExportSource,
} from "./asset-export";
import {
  ADMIN_EXPORT_COLUMNS,
  STAFF_EXPORT_COLUMNS,
} from "./asset-export-columns";
import type { AssetListUrlState } from "./asset-list-url";
import type { XlsxCell } from "./xlsx-cells";

const LABELS: AssetExportLabels = {
  status: {
    active: "Aktif",
    in_repair: "Diperbaiki",
    loaned: "Dipinjam",
    retired: "Tidak digunakan",
    lost: "Hilang",
  },
  condition: { good: "Baik", fair: "Cukup", poor: "Rusak" },
};

const STAFF_ROW: AssetExportSource = {
  id: "01931f00-0000-7000-8000-000000000001",
  assetCode: "PPM-ELK-2026-0001",
  name: "Proyektor Epson",
  category: { name: "Elektronik" },
  room: { name: "Ruang Rapat", building: { name: "Gedung Bangkit" } },
  brand: "Epson",
  model: "EB-X06",
  serialNumber: null,
  universityAssetCode: "TU-000123",
  condition: "good",
  status: "in_repair",
  acquisitionYear: 2026,
  notes: null,
};

const ADMIN_ROW: AssetExportSource = {
  ...STAFF_ROW,
  purchasePrice: { toNumber: () => 7_250_000 },
  fundingSource: { name: "RKA 2026" },
  procurementDocNo: "SPK/2026/017",
  vendor: "CV Sumber Terang",
  warrantyUntil: new Date("2028-03-01T00:00:00.000Z"),
  custodianName: "Budi Santoso",
  custodianEmail: "budi@example.ac.id",
};

function cellsFor(
  row: AssetExportSource,
  columns: typeof STAFF_EXPORT_COLUMNS,
): ReadonlyMap<string, XlsxCell> {
  const cells = toAssetExportCells(row, columns, LABELS);
  return new Map(columns.map((column, index) => [column.id, cells[index]]));
}

describe("toDecimalNumber", () => {
  it.each([
    ["null", null, null],
    ["undefined", undefined, null],
    ["a plain number", 1500, 1500],
  ])("maps %s", (_label, input, expected) => {
    expect(toDecimalNumber(input)).toBe(expected);
  });

  it("unwraps a Prisma Decimal into a number the cell can hold", () => {
    expect(toDecimalNumber({ toNumber: () => 7_250_000 })).toBe(7_250_000);
  });
});

describe("toAssetExportCells", () => {
  it("produces exactly one cell per column, in column order", () => {
    expect(
      toAssetExportCells(STAFF_ROW, STAFF_EXPORT_COLUMNS, LABELS),
    ).toHaveLength(STAFF_EXPORT_COLUMNS.length);
  });

  it("flattens the room's building into its own column", () => {
    const cells = cellsFor(STAFF_ROW, STAFF_EXPORT_COLUMNS);
    expect(cells.get("building")?.value).toBe("Gedung Bangkit");
    expect(cells.get("room")?.value).toBe("Ruang Rapat");
  });

  it("localises the two fixed enumerations rather than exporting raw members", () => {
    const cells = cellsFor(STAFF_ROW, STAFF_EXPORT_COLUMNS);
    expect(cells.get("status")?.value).toBe("Diperbaiki");
    expect(cells.get("condition")?.value).toBe("Baik");
  });

  it("exports the acquisition year as a number under the integer style", () => {
    const year = cellsFor(STAFF_ROW, STAFF_EXPORT_COLUMNS).get(
      "acquisitionYear",
    );
    expect(year).toEqual({ value: 2026, style: "integer" });
  });

  it("exports a price as a number, never as pre-formatted rupiah text", () => {
    const price = cellsFor(ADMIN_ROW, ADMIN_EXPORT_COLUMNS).get(
      "purchasePrice",
    );
    expect(price).toEqual({ value: 7_250_000, style: "currency" });
  });

  it("exports a warranty as a Date, never as an ISO string", () => {
    const warranty = cellsFor(ADMIN_ROW, ADMIN_EXPORT_COLUMNS).get(
      "warrantyUntil",
    );
    expect(warranty?.value).toBeInstanceOf(Date);
    expect(warranty?.style).toBe("date");
  });

  it("leaves an unset optional column blank rather than writing a placeholder", () => {
    const cells = cellsFor(STAFF_ROW, STAFF_EXPORT_COLUMNS);
    expect(cells.get("serialNumber")?.value).toBeNull();
    expect(cells.get("notes")?.value).toBeNull();
  });

  it("leaves every restricted value blank when a staff row reaches admin columns", () => {
    const cells = cellsFor(STAFF_ROW, ADMIN_EXPORT_COLUMNS);
    for (const id of [
      "purchasePrice",
      "fundingSource",
      "procurementDocNo",
      "vendor",
      "warrantyUntil",
      "custodianName",
      "custodianEmail",
    ]) {
      expect(cells.get(id)?.value).toBeNull();
    }
  });
});

describe("measureColumnWidths", () => {
  it("returns one width per header", () => {
    expect(measureColumnWidths(["a", "b", "c"], [])).toHaveLength(3);
  });

  it("never falls below the minimum, however short the content", () => {
    expect(measureColumnWidths(["a"], [])).toEqual([10]);
  });

  it("never exceeds the maximum, however long the content", () => {
    const long = [[{ value: "x".repeat(500), style: "text" as const }]];
    expect(measureColumnWidths(["notes"], long)).toEqual([48]);
  });

  it("widens a column to fit the longest sampled value", () => {
    const rows = [
      [{ value: "short", style: "text" as const }],
      [{ value: "a considerably longer value", style: "text" as const }],
    ];
    expect(measureColumnWidths(["x"], rows)).toEqual([30]);
  });

  it("counts a date as its rendered width, not its serial number", () => {
    const rows = [
      [{ value: new Date("2028-03-01T00:00:00.000Z"), style: "date" as const }],
    ];
    expect(measureColumnWidths(["d"], rows)).toEqual([13]);
  });

  it("ignores a row that is shorter than the header list", () => {
    const rows = [[{ value: "only one", style: "text" as const }]];
    expect(measureColumnWidths(["a", "b"], rows)).toEqual([11, 10]);
  });
});

describe("the export size guard", () => {
  it.each([
    [0, false],
    [MAX_ASSET_EXPORT_ROWS - 1, false],
    [MAX_ASSET_EXPORT_ROWS, false],
    [MAX_ASSET_EXPORT_ROWS + 1, true],
  ])("refuses %i rows: %s", (totalCount, expected) => {
    expect(isAssetExportTooLarge(totalCount)).toBe(expected);
  });

  it("reads the register in chunks smaller than the cap", () => {
    expect(ASSET_EXPORT_CHUNK_SIZE).toBeLessThan(MAX_ASSET_EXPORT_ROWS);
  });
});

describe("assetExportFileName", () => {
  it("carries the export date, stamped in the register's own time zone", () => {
    expect(assetExportFileName(new Date("2026-08-22T09:30:00.000Z"))).toBe(
      "assets-2026-08-22.xlsx",
    );
  });

  it("names the Jakarta day, not the UTC one, early in the working day", () => {
    // 06:00 in Jakarta on the 22nd is still the 21st in UTC.
    expect(assetExportDateStamp(new Date("2026-08-21T23:00:00.000Z"))).toBe(
      "2026-08-22",
    );
  });
});

const LIST_STATE: AssetListUrlState = {
  sort: "createdAt",
  dir: "desc",
  page: 1,
  pageSize: 10,
};

describe("buildAssetExportHref", () => {
  it("is the bare export path when no filter is applied", () => {
    expect(buildAssetExportHref(LIST_STATE)).toBe("/assets/export");
  });

  it("carries every active filter and the sort forward", () => {
    const href = buildAssetExportHref({
      ...LIST_STATE,
      q: "proyektor",
      status: "active",
      sort: "name",
      dir: "asc",
    });
    const query = new URLSearchParams(href.split("?")[1]);

    expect(query.get("q")).toBe("proyektor");
    expect(query.get("status")).toBe("active");
    expect(query.get("sort")).toBe("name");
    expect(query.get("dir")).toBe("asc");
  });

  it("drops the page and page size, which describe the screen and not the selection", () => {
    const href = buildAssetExportHref({
      ...LIST_STATE,
      page: 4,
      pageSize: 100,
    });
    expect(href).toBe("/assets/export");
  });
});
