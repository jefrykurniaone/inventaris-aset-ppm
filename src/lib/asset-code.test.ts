import { describe, expect, it } from "vitest";

import {
  assetCodeLockKey,
  assetCodeNamespacePrefix,
  ASSET_CODE_SEQUENCE_DIGITS,
  FIRST_ASSET_CODE_SEQUENCE,
  formatAssetCode,
  MAX_ASSET_CODE_SEQUENCE,
  nextAssetCodeSequence,
  parseAssetCode,
  parseAssetCodeSequence,
} from "./asset-code";

const CATEGORY_CODE = "LAB";
const YEAR = 2026;

describe("formatAssetCode", () => {
  it.each([
    [1, "PPM-LAB-2026-0001"],
    [9, "PPM-LAB-2026-0009"],
    [10, "PPM-LAB-2026-0010"],
    [100, "PPM-LAB-2026-0100"],
    [1000, "PPM-LAB-2026-1000"],
    [MAX_ASSET_CODE_SEQUENCE, "PPM-LAB-2026-9999"],
  ])("zero-pads sequence %i to %s", (sequence, expected) => {
    expect(
      formatAssetCode({
        categoryCode: CATEGORY_CODE,
        acquisitionYear: YEAR,
        sequence,
      }),
    ).toBe(expected);
  });

  it("uses the category code and year it is given, not a fixed pair", () => {
    expect(
      formatAssetCode({
        categoryCode: "OFC",
        acquisitionYear: 2019,
        sequence: 42,
      }),
    ).toBe("PPM-OFC-2019-0042");
  });

  it.each([
    ["zero", 0],
    ["negative", -1],
    ["beyond four digits", MAX_ASSET_CODE_SEQUENCE + 1],
    ["fractional", 1.5],
    ["not a number", Number.NaN],
  ])(
    "refuses a %s sequence rather than emitting a bad code",
    (_label, sequence) => {
      expect(() =>
        formatAssetCode({
          categoryCode: CATEGORY_CODE,
          acquisitionYear: YEAR,
          sequence,
        }),
      ).toThrow(RangeError);
    },
  );
});

describe("assetCodeNamespacePrefix", () => {
  it("is the stem every code in one category and year shares", () => {
    expect(assetCodeNamespacePrefix(CATEGORY_CODE, YEAR)).toBe("PPM-LAB-2026-");
  });

  it("prefixes the code the formatter produces for the same namespace", () => {
    const prefix = assetCodeNamespacePrefix(CATEGORY_CODE, YEAR);
    const code = formatAssetCode({
      categoryCode: CATEGORY_CODE,
      acquisitionYear: YEAR,
      sequence: 7,
    });

    expect(code.startsWith(prefix)).toBe(true);
  });
});

describe("parseAssetCode", () => {
  it("reads back exactly what formatAssetCode wrote", () => {
    const parts = {
      categoryCode: "FUR",
      acquisitionYear: 2024,
      sequence: 305,
    };

    expect(parseAssetCode(formatAssetCode(parts))).toEqual(parts);
  });

  it("strips the zero padding rather than returning a string", () => {
    expect(parseAssetCodeSequence("PPM-IT-2026-0007")).toBe(7);
  });

  it.each([
    ["an empty string", ""],
    ["a different prefix", "TEL-LAB-2026-0001"],
    ["a lowercase category code", "PPM-lab-2026-0001"],
    ["a category code that is too long", "PPM-LABEL-2026-0001"],
    ["a two-digit year", "PPM-LAB-26-0001"],
    ["a three-digit sequence", "PPM-LAB-2026-001"],
    ["a five-digit sequence", "PPM-LAB-2026-00001"],
    ["trailing text", "PPM-LAB-2026-0001 "],
    ["leading text", " PPM-LAB-2026-0001"],
    ["an embedded newline before the code", "x\nPPM-LAB-2026-0001"],
  ])("returns null for %s", (_label, code) => {
    expect(parseAssetCode(code)).toBeNull();
    expect(parseAssetCodeSequence(code)).toBeNull();
  });
});

describe("nextAssetCodeSequence", () => {
  it("starts a fresh namespace at the first sequence", () => {
    expect(nextAssetCodeSequence([])).toBe(FIRST_ASSET_CODE_SEQUENCE);
  });

  it("continues from the highest code issued, not from the count", () => {
    expect(
      nextAssetCodeSequence(["PPM-LAB-2026-0001", "PPM-LAB-2026-0009"]),
    ).toBe(10);
  });

  it("never reuses a gap left by a removed row", () => {
    // 0002 is gone — soft-deleted, or deleted outright. Its label may still be
    // stuck to something, so 2 must not be handed out a second time.
    expect(
      nextAssetCodeSequence(["PPM-LAB-2026-0001", "PPM-LAB-2026-0003"]),
    ).toBe(4);
  });

  it("does not depend on the order the codes arrive in", () => {
    expect(
      nextAssetCodeSequence(["PPM-LAB-2026-0012", "PPM-LAB-2026-0004"]),
    ).toBe(13);
  });

  it("ignores a code it cannot parse instead of restarting the namespace", () => {
    expect(nextAssetCodeSequence(["nonsense", "PPM-LAB-2026-0005"])).toBe(6);
  });

  it("reports exhaustion once the four digits are used up", () => {
    expect(nextAssetCodeSequence(["PPM-LAB-2026-9999"])).toBeNull();
  });

  it("still issues the last available sequence", () => {
    expect(nextAssetCodeSequence(["PPM-LAB-2026-9998"])).toBe(
      MAX_ASSET_CODE_SEQUENCE,
    );
  });
});

describe("ASSET_CODE_SEQUENCE_DIGITS", () => {
  it("agrees with the maximum sequence it implies", () => {
    expect(String(MAX_ASSET_CODE_SEQUENCE)).toHaveLength(
      ASSET_CODE_SEQUENCE_DIGITS,
    );
  });
});

describe("assetCodeLockKey", () => {
  it("fits a signed 32-bit integer, which is what pg_advisory_xact_lock takes", () => {
    const key = assetCodeLockKey("0198c0de-1234-7000-8000-000000000001", YEAR);

    expect(Number.isInteger(key)).toBe(true);
    expect(key).toBeGreaterThanOrEqual(-(2 ** 31));
    expect(key).toBeLessThanOrEqual(2 ** 31 - 1);
  });

  it("is stable for the same category and year", () => {
    expect(assetCodeLockKey("category-1", YEAR)).toBe(
      assetCodeLockKey("category-1", YEAR),
    );
  });

  it("separates two years of the same category", () => {
    expect(assetCodeLockKey("category-1", YEAR)).not.toBe(
      assetCodeLockKey("category-1", YEAR + 1),
    );
  });

  it("separates two categories in the same year", () => {
    expect(assetCodeLockKey("category-1", YEAR)).not.toBe(
      assetCodeLockKey("category-2", YEAR),
    );
  });

  it("does not fold the separator away, so a:b and ab:… stay distinct", () => {
    expect(assetCodeLockKey("category", 12026)).not.toBe(
      assetCodeLockKey("category:1", 2026),
    );
  });

  it("handles an empty category id without leaving the integer range", () => {
    const key = assetCodeLockKey("", YEAR);

    expect(Number.isInteger(key)).toBe(true);
    expect(Math.abs(key)).toBeLessThanOrEqual(2 ** 31);
  });
});
