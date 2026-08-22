import { describe, expect, it } from "vitest";

import {
  diffAssets,
  hasChanges,
  splitStatusChange,
  toComparableAsset,
  type StoredAssetFields,
} from "./activity";
import { assetSchema, type AssetInput } from "./schemas";

const YEAR = 2026;

function input(overrides: Record<string, unknown> = {}): AssetInput {
  return assetSchema.parse({
    name: "Mikroskop Binokuler",
    categoryId: "category-1",
    roomId: "room-1",
    condition: "good",
    status: "active",
    acquisitionYear: String(YEAR),
    ...overrides,
  });
}

/** A stub of Prisma's `Decimal` — the only member this module touches. */
function decimal(text: string) {
  return { toFixed: () => text };
}

function storedRow(overrides: Partial<StoredAssetFields> = {}) {
  const base: StoredAssetFields = {
    name: "Mikroskop Binokuler",
    categoryId: "category-1",
    roomId: "room-1",
    condition: "good",
    status: "active",
    acquisitionYear: YEAR,
    brand: null,
    model: null,
    serialNumber: null,
    universityAssetCode: null,
    notes: null,
    purchasePrice: null,
    fundingSourceId: null,
    procurementDocNo: null,
    vendor: null,
    warrantyUntil: null,
    custodianName: null,
    custodianEmail: null,
  };
  return { ...base, ...overrides };
}

describe("toComparableAsset", () => {
  it("puts a stored row and an identical submission on the same footing", () => {
    expect(toComparableAsset(storedRow())).toEqual(toComparableAsset(input()));
  });

  it("renders a Decimal price as its fixed-point string, not as an object", () => {
    const comparable = toComparableAsset(
      storedRow({ purchasePrice: decimal("1500.00") }),
    );

    expect(comparable.purchasePrice).toBe("1500.00");
  });

  it("renders a Date as an ISO string, so two equal dates compare equal", () => {
    const comparable = toComparableAsset(
      storedRow({ warrantyUntil: new Date("2027-03-15T00:00:00.000Z") }),
    );

    expect(comparable.warrantyUntil).toBe("2027-03-15T00:00:00.000Z");
  });
});

describe("diffAssets", () => {
  it("reports nothing when a submission repeats the stored row exactly", () => {
    const changes = diffAssets(
      toComparableAsset(storedRow()),
      toComparableAsset(input()),
    );

    expect(hasChanges(changes)).toBe(false);
    expect(changes).toEqual({});
  });

  it("names the field that changed, with both values, and nothing else", () => {
    const changes = diffAssets(
      toComparableAsset(storedRow()),
      toComparableAsset(input({ name: "Proyektor" })),
    );

    expect(changes).toEqual({
      name: { from: "Mikroskop Binokuler", to: "Proyektor" },
    });
  });

  it("is not a full row dump — an eighteen-field submission with one edit yields one entry", () => {
    const changes = diffAssets(
      toComparableAsset(storedRow()),
      toComparableAsset(input({ vendor: "CV Sumber Ilmu" })),
    );

    expect(Object.keys(changes)).toEqual(["vendor"]);
  });

  it("treats an unchanged price as unchanged despite Decimal and string differing in type", () => {
    const changes = diffAssets(
      toComparableAsset(storedRow({ purchasePrice: decimal("1500.00") })),
      toComparableAsset(input({ purchasePrice: "1500" })),
    );

    expect(changes).toEqual({});
  });

  it("catches a price that really did change", () => {
    const changes = diffAssets(
      toComparableAsset(storedRow({ purchasePrice: decimal("1500.00") })),
      toComparableAsset(input({ purchasePrice: "1750.25" })),
    );

    expect(changes).toEqual({
      purchasePrice: { from: "1500.00", to: "1750.25" },
    });
  });

  it("records a cleared optional field as a change to null", () => {
    const changes = diffAssets(
      toComparableAsset(storedRow({ vendor: "CV Sumber Ilmu" })),
      toComparableAsset(input()),
    );

    expect(changes).toEqual({ vendor: { from: "CV Sumber Ilmu", to: null } });
  });

  it("reports several fields at once", () => {
    const changes = diffAssets(
      toComparableAsset(storedRow()),
      toComparableAsset(input({ condition: "poor", brand: "Olympus" })),
    );

    expect(Object.keys(changes).toSorted()).toEqual(["brand", "condition"]);
  });
});

describe("splitStatusChange", () => {
  it("lifts the status transition out, so it becomes its own activity row", () => {
    const changes = diffAssets(
      toComparableAsset(storedRow()),
      toComparableAsset(input({ status: "retired" })),
    );

    const { statusChange, otherChanges } = splitStatusChange(changes);

    expect(statusChange).toEqual({ from: "active", to: "retired" });
    expect(otherChanges).toEqual({});
  });

  it("keeps the other fields of the same submission for the updated row", () => {
    const changes = diffAssets(
      toComparableAsset(storedRow()),
      toComparableAsset(input({ status: "lost", notes: "Hilang saat pindah" })),
    );

    const { statusChange, otherChanges } = splitStatusChange(changes);

    expect(statusChange).toEqual({ from: "active", to: "lost" });
    expect(otherChanges).toEqual({
      notes: { from: null, to: "Hilang saat pindah" },
    });
  });

  it("reports no status change when the status was left alone", () => {
    const changes = diffAssets(
      toComparableAsset(storedRow()),
      toComparableAsset(input({ brand: "Olympus" })),
    );

    expect(splitStatusChange(changes).statusChange).toBeNull();
  });
});

describe("hasChanges", () => {
  it("is false for an empty diff and true for any entry", () => {
    expect(hasChanges({})).toBe(false);
    expect(hasChanges({ name: { from: "a", to: "b" } })).toBe(true);
  });
});
