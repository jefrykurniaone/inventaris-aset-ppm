import { describe, expect, it } from "vitest";

import {
  ADMIN_ASSET_EXPORT_SELECT,
  ADMIN_EXPORT_COLUMNS,
  assetExportColumnsFor,
  assetExportSelectFor,
  RESTRICTED_ASSET_EXPORT_FIELDS,
  STAFF_ASSET_EXPORT_SELECT,
  STAFF_EXPORT_COLUMNS,
} from "./asset-export-columns";

/**
 * The assertion that matters in this file is the recursive one: a staff
 * export's selection object must not *name* a restricted column anywhere,
 * nested selects included. It is written against the selection object rather
 * than against a produced workbook because the selection is what becomes SQL
 * — a column omitted from a rendered sheet has still been read out of the
 * database, logged by any query logger, and held in the function's memory.
 */

/** Every key appearing anywhere in a Prisma selection tree. */
function collectSelectKeys(selection: unknown, found: Set<string>): void {
  if (typeof selection !== "object" || selection === null) {
    return;
  }
  for (const [key, value] of Object.entries(selection)) {
    found.add(key);
    collectSelectKeys(value, found);
  }
}

function selectKeysOf(selection: unknown): ReadonlySet<string> {
  const found = new Set<string>();
  collectSelectKeys(selection, found);
  return found;
}

describe("STAFF_ASSET_EXPORT_SELECT", () => {
  it.each(RESTRICTED_ASSET_EXPORT_FIELDS)(
    "never names the restricted column %s, at any depth",
    (field) => {
      expect(selectKeysOf(STAFF_ASSET_EXPORT_SELECT).has(field)).toBe(false);
    },
  );

  it("still selects everything the thirteen staff columns render", () => {
    const keys = selectKeysOf(STAFF_ASSET_EXPORT_SELECT);
    for (const key of [
      "assetCode",
      "name",
      "category",
      "room",
      "building",
      "brand",
      "model",
      "serialNumber",
      "universityAssetCode",
      "condition",
      "status",
      "acquisitionYear",
      "notes",
    ]) {
      expect(keys.has(key)).toBe(true);
    }
  });

  it("selects the id the export cursor pages on", () => {
    expect(selectKeysOf(STAFF_ASSET_EXPORT_SELECT).has("id")).toBe(true);
  });
});

describe("ADMIN_ASSET_EXPORT_SELECT", () => {
  it.each(
    RESTRICTED_ASSET_EXPORT_FIELDS.filter(
      (field) => field !== "fundingSourceId",
    ),
  )("selects the restricted column %s", (field) => {
    expect(selectKeysOf(ADMIN_ASSET_EXPORT_SELECT).has(field)).toBe(true);
  });

  it("is a superset of the staff selection", () => {
    const adminKeys = selectKeysOf(ADMIN_ASSET_EXPORT_SELECT);
    for (const key of selectKeysOf(STAFF_ASSET_EXPORT_SELECT)) {
      expect(adminKeys.has(key)).toBe(true);
    }
  });
});

describe("assetExportSelectFor", () => {
  it.each([
    [true, ADMIN_ASSET_EXPORT_SELECT],
    [false, STAFF_ASSET_EXPORT_SELECT],
  ])("hands isAdmin=%s its own selection", (isAdmin, expected) => {
    expect(assetExportSelectFor(isAdmin)).toBe(expected);
  });
});

describe("assetExportColumnsFor", () => {
  it("gives staff the thirteen public columns and nothing else", () => {
    expect(assetExportColumnsFor(false)).toBe(STAFF_EXPORT_COLUMNS);
    expect(STAFF_EXPORT_COLUMNS).toHaveLength(13);
  });

  it("adds the six financial columns and the custodian for an admin", () => {
    expect(assetExportColumnsFor(true)).toBe(ADMIN_EXPORT_COLUMNS);
    expect(ADMIN_EXPORT_COLUMNS).toHaveLength(20);
  });

  it("keeps the public columns in the same order for both roles", () => {
    const staffIds = STAFF_EXPORT_COLUMNS.map((column) => column.id);
    const adminIds = ADMIN_EXPORT_COLUMNS.map((column) => column.id);
    expect(adminIds.slice(0, staffIds.length)).toEqual(staffIds);
  });

  it("gives the year an integer format, not a grouped or currency one", () => {
    const year = STAFF_EXPORT_COLUMNS.find(
      (column) => column.id === "acquisitionYear",
    );
    expect(year?.style).toBe("integer");
  });

  it("gives the price a currency format and the warranty a date format", () => {
    const byId = new Map(ADMIN_EXPORT_COLUMNS.map((c) => [c.id, c.style]));
    expect(byId.get("purchasePrice")).toBe("currency");
    expect(byId.get("warrantyUntil")).toBe("date");
  });
});
