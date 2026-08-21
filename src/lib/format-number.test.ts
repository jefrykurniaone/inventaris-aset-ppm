import { describe, expect, it } from "vitest";

import { formatCurrencyIdr, formatInteger } from "./format-number";

describe("formatInteger", () => {
  it("uses a period as the thousands separator for id", () => {
    expect(formatInteger(1_234_567, "id")).toBe("1.234.567");
  });

  it("uses a comma as the thousands separator for en", () => {
    expect(formatInteger(1_234_567, "en")).toBe("1,234,567");
  });

  it("renders zero without a sign in either locale", () => {
    expect(formatInteger(0, "id")).toBe("0");
    expect(formatInteger(0, "en")).toBe("0");
  });
});

describe("formatCurrencyIdr", () => {
  it("renders an amount above one million with the id thousands separator", () => {
    const result = formatCurrencyIdr(1_500_000, "id");
    expect(result).toContain("1.500.000");
  });

  it("renders the same amount readably in en, with a comma separator", () => {
    const result = formatCurrencyIdr(1_500_000, "en");
    expect(result).toContain("1,500,000");
  });

  it("renders a zero value distinctly in both locales, with no decimals", () => {
    expect(formatCurrencyIdr(0, "id")).not.toContain(",");
    expect(formatCurrencyIdr(0, "en")).toMatch(/0(?!,00)/);
    expect(formatCurrencyIdr(0, "id")).toMatch(/0$/);
  });
});
