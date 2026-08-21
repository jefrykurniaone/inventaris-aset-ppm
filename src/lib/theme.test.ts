import { describe, expect, it } from "vitest";

import { defaultTheme, resolveTheme, themeSchema } from "./theme";

describe("themeSchema", () => {
  it("accepts every supported theme", () => {
    expect(themeSchema.parse("light")).toBe("light");
    expect(themeSchema.parse("dark")).toBe("dark");
  });

  it("rejects a value outside the supported themes, per server-action input validation", () => {
    expect(() => themeSchema.parse("system")).toThrow();
    expect(() => themeSchema.parse("")).toThrow();
    expect(() => themeSchema.parse("Dark")).toThrow();
  });

  it("reports failure via safeParse rather than throwing, for read-time resolution", () => {
    expect(themeSchema.safeParse("system").success).toBe(false);
    expect(themeSchema.safeParse("dark").success).toBe(true);
  });
});

describe("resolveTheme", () => {
  it("passes through a supported theme unchanged", () => {
    expect(resolveTheme("light")).toBe("light");
    expect(resolveTheme("dark")).toBe("dark");
  });

  it("falls back to the default for an unsupported or missing value", () => {
    expect(resolveTheme("system")).toBe(defaultTheme);
    expect(resolveTheme(undefined)).toBe(defaultTheme);
    expect(resolveTheme("")).toBe(defaultTheme);
  });
});
