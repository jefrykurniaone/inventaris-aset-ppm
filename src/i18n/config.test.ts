import { describe, expect, it } from "vitest";

import { defaultLocale, localeSchema, resolveLocale } from "./config";

describe("localeSchema", () => {
  it("accepts every supported locale", () => {
    expect(localeSchema.parse("id")).toBe("id");
    expect(localeSchema.parse("en")).toBe("en");
  });

  it("rejects a value outside the supported locales, per server-action input validation", () => {
    expect(() => localeSchema.parse("fr")).toThrow();
    expect(() => localeSchema.parse("")).toThrow();
    expect(() => localeSchema.parse("id-ID")).toThrow();
  });

  it("reports failure via safeParse rather than throwing, for read-time resolution", () => {
    expect(localeSchema.safeParse("fr").success).toBe(false);
    expect(localeSchema.safeParse("id").success).toBe(true);
  });
});

describe("resolveLocale", () => {
  it("passes through a supported locale unchanged", () => {
    expect(resolveLocale("id")).toBe("id");
    expect(resolveLocale("en")).toBe("en");
  });

  it("falls back to the default for an unsupported or missing value", () => {
    expect(resolveLocale("fr")).toBe(defaultLocale);
    expect(resolveLocale(undefined)).toBe(defaultLocale);
    expect(resolveLocale("")).toBe(defaultLocale);
  });
});
