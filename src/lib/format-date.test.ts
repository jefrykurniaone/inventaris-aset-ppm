import { describe, expect, it } from "vitest";

import { formatDate, formatDateTime } from "./format-date";

/** Noon UTC keeps the Asia/Jakarta (UTC+7) day from rolling over. */
const SAMPLE_DATE = new Date("2026-08-21T12:00:00.000Z");

describe("formatDate", () => {
  it("renders the full Indonesian month name for id", () => {
    expect(formatDate(SAMPLE_DATE, "id")).toBe("21 Agustus 2026");
  });

  it("renders the full English month name for en", () => {
    expect(formatDate(SAMPLE_DATE, "en")).toBe("August 21, 2026");
  });
});

describe("formatDateTime", () => {
  it("includes the Asia/Jakarta time alongside the date for id", () => {
    const result = formatDateTime(SAMPLE_DATE, "id");
    expect(result).toContain("21 Agustus 2026");
    expect(result).toContain("19.00");
  });

  it("includes the Asia/Jakarta time alongside the date for en", () => {
    const result = formatDateTime(SAMPLE_DATE, "en");
    expect(result).toContain("August 21, 2026");
    expect(result).toContain("7:00");
  });
});
