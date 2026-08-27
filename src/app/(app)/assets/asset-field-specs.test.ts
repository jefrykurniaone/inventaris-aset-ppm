import { describe, expect, it } from "vitest";

import { isMarkedRequired } from "@/lib/required-marker";

import {
  ASSET_DETAIL_FIELD_SPECS,
  ASSET_PROCUREMENT_FIELD_SPECS,
  type AssetFieldSpec,
} from "./asset-field-specs";

/**
 * Which asset labels carry the required marker (issue #103).
 *
 * Asserted against the real spec table rather than a fixture, because the table
 * *is* the decision: the derivation is trivial and the data is what a later
 * change gets wrong. A field made required without a marker, or a marker left
 * on a field that stopped being required, fails here.
 */

const ALL_ASSET_FIELD_SPECS: readonly AssetFieldSpec[] = [
  ...ASSET_DETAIL_FIELD_SPECS,
  ...ASSET_PROCUREMENT_FIELD_SPECS,
];

function markedFieldNames(specs: readonly AssetFieldSpec[]): readonly string[] {
  return specs.filter(isMarkedRequired).map((spec) => spec.name);
}

describe("asset field marker set", () => {
  it("marks exactly the five fields a user must fill", () => {
    expect(markedFieldNames(ALL_ASSET_FIELD_SPECS)).toEqual([
      "name",
      "categoryId",
      "roomId",
      "condition",
      "acquisitionYear",
    ]);
  });

  it("leaves status unmarked even though the schema requires it", () => {
    const status = ALL_ASSET_FIELD_SPECS.find((spec) => spec.name === "status");

    expect(status?.isRequired).toBe(true);
    expect(isMarkedRequired(status ?? {})).toBe(false);
  });

  it("marks nothing in the procurement section, where every field is optional", () => {
    expect(markedFieldNames(ASSET_PROCUREMENT_FIELD_SPECS)).toEqual([]);
  });

  it("exempts a required field only when it declares a pre-filled default", () => {
    const exempted = ALL_ASSET_FIELD_SPECS.filter(
      (spec) => spec.isRequired === true && spec.hasPrefilledDefault === true,
    ).map((spec) => spec.name);

    expect(exempted).toEqual(["status"]);
  });
});
