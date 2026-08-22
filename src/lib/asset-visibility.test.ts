import { describe, expect, it } from "vitest";

import {
  ANONYMOUS_ASSET_SCAN_SELECT,
  RESTRICTED_ASSET_COLUMNS,
  RESTRICTED_LOAN_COLUMNS,
  SIGNED_IN_ASSET_SCAN_SELECT,
  assetScanSelectFor,
} from "./asset-visibility";

/**
 * The acceptance criterion for issue #11 is asserted here, against the
 * selection object, not against rendered output: a page that renders nothing
 * restricted while its query still fetches the columns has already lost the
 * data to the RSC payload.
 *
 * The walk is recursive and array-aware because a selection nests — a
 * restricted column can hide inside `photos.select`, inside `loans.select`, or
 * inside an `orderBy` entry, and a shallow `Object.keys` check would pass
 * while all three leaked.
 */
function collectSelectionKeys(node: unknown, into: Set<string>): void {
  if (Array.isArray(node)) {
    for (const item of node) {
      collectSelectionKeys(item, into);
    }
    return;
  }
  if (typeof node !== "object" || node === null) {
    return;
  }
  for (const [key, value] of Object.entries(node)) {
    into.add(key);
    collectSelectionKeys(value, into);
  }
}

function selectionKeysOf(selection: unknown): ReadonlySet<string> {
  const keys = new Set<string>();
  collectSelectionKeys(selection, keys);
  return keys;
}

const RESTRICTED_COLUMNS: readonly string[] = [
  ...RESTRICTED_ASSET_COLUMNS,
  ...RESTRICTED_LOAN_COLUMNS,
];

/**
 * The restricted columns the signed-in page actually renders.
 *
 * Shorter than `RESTRICTED_COLUMNS` by the three foreign-key scalars —
 * `fundingSourceId`, `createdById`, `handledById` — because a selection reads
 * the relation's `name` rather than the key it joins on. They stay in the
 * restricted list all the same: naming either side of a relation in a public
 * select is the same leak, and the anonymous check above is the one that has
 * to see both spellings.
 */
const RESTRICTED_COLUMNS_RENDERED: readonly string[] = [
  "purchasePrice",
  "fundingSource",
  "procurementDocNo",
  "vendor",
  "warrantyUntil",
  "custodianName",
  "custodianEmail",
  "createdBy",
  "borrowerName",
  "borrowerEmail",
  "borrowerUnit",
  "handledBy",
];

/** Everything §8.2 marks PUBLIC, plus `deletedAt`, which is the FR-2.5 state
 * discriminator rather than a rendered field. */
const PUBLIC_COLUMNS: readonly string[] = [
  "assetCode",
  "name",
  "condition",
  "status",
  "brand",
  "model",
  "serialNumber",
  "universityAssetCode",
  "acquisitionYear",
  "notes",
  "qrToken",
  "deletedAt",
  "category",
  "room",
  "photos",
  "loans",
];

const anonymousKeys = selectionKeysOf(ANONYMOUS_ASSET_SCAN_SELECT);
const signedInKeys = selectionKeysOf(SIGNED_IN_ASSET_SCAN_SELECT);

describe("the anonymous scan selection", () => {
  it("names no restricted column anywhere, at any nesting depth", () => {
    const leaked = RESTRICTED_COLUMNS.filter((column) =>
      anonymousKeys.has(column),
    );

    expect(
      leaked,
      `PRD §8.2 RESTRICTED columns named by the anonymous scan selection: ${leaked.join(", ")}`,
    ).toEqual([]);
  });

  it("names every public column, so the split hides nothing it should show", () => {
    const missing = PUBLIC_COLUMNS.filter(
      (column) => !anonymousKeys.has(column),
    );

    expect(
      missing,
      `PRD §8.2 PUBLIC columns absent from the anonymous scan selection: ${missing.join(", ")}`,
    ).toEqual([]);
  });

  it("omits the asset row id, so a public page reveals no register key", () => {
    expect(Object.keys(ANONYMOUS_ASSET_SCAN_SELECT)).not.toContain("id");
  });

  it("reads a loan's due date and nothing else about the loan", () => {
    expect(Object.keys(ANONYMOUS_ASSET_SCAN_SELECT.loans.select)).toEqual([
      "dueAt",
    ]);
  });
});

describe("the signed-in scan selection", () => {
  it("names every rendered restricted column, so the anonymous check is not vacuous", () => {
    const missing = RESTRICTED_COLUMNS_RENDERED.filter(
      (column) => !signedInKeys.has(column),
    );

    expect(
      missing,
      `RESTRICTED columns absent from the signed-in scan selection: ${missing.join(", ")}`,
    ).toEqual([]);
  });

  it("is a superset of the anonymous selection", () => {
    const missing = [...anonymousKeys].filter((key) => !signedInKeys.has(key));

    expect(missing).toEqual([]);
  });

  it("reads the asset row id, which is what the link to the full record needs", () => {
    expect(Object.keys(SIGNED_IN_ASSET_SCAN_SELECT)).toContain("id");
  });
});

describe("assetScanSelectFor", () => {
  it("hands an anonymous visitor the anonymous selection", () => {
    expect(assetScanSelectFor("anonymous")).toBe(ANONYMOUS_ASSET_SCAN_SELECT);
  });

  it("hands a signed-in visitor the signed-in selection", () => {
    expect(assetScanSelectFor("signedIn")).toBe(SIGNED_IN_ASSET_SCAN_SELECT);
  });

  it("returns two genuinely different objects", () => {
    expect(ANONYMOUS_ASSET_SCAN_SELECT).not.toBe(SIGNED_IN_ASSET_SCAN_SELECT);
    expect(anonymousKeys.size).toBeLessThan(signedInKeys.size);
  });
});
