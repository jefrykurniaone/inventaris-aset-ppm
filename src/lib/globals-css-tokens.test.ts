import { describe, expect, it } from "vitest";

import {
  collectSelectorBlocks,
  FULL_OPACITY,
  mergeDeclarations,
  parseRingAlpha,
  readRingRenderedAlpha,
  readThemeTokens,
  SINGLE_BLOCK,
  tokenValue,
} from "./globals-css-tokens";

describe("theme token reader", () => {
  it("sees every occurrence of a selector, not just the first", () => {
    const css = ".dark { --a: 1; }\n.dark { --b: 2; }";
    expect(collectSelectorBlocks(css, ".dark")).toHaveLength(2);
  });

  it("merges repeated blocks so the last declaration wins", () => {
    const css = ":root { --primary: #b6252a; }\n:root { --primary: #4a0d10; }";
    expect(mergeDeclarations(collectSelectorBlocks(css, ":root"))).toEqual(
      new Map([["--primary", "#4a0d10"]]),
    );
  });

  it("skips a block whose body contains nested rules", () => {
    const css =
      "@layer base { * { color: red; } }\n:root { --primary: #b6252a; }";
    expect(mergeDeclarations(collectSelectorBlocks(css, ":root"))).toEqual(
      new Map([["--primary", "#b6252a"]]),
    );
  });

  it("refuses a selector nested inside an at-rule", () => {
    const css =
      "@media (prefers-color-scheme: dark) { :root { --primary: #4a0d10; } }";
    expect(() => collectSelectorBlocks(css, ":root")).toThrow(/nested inside/);
  });

  it("refuses to read a theme whose block count is not the expected one", () => {
    expect(() => readThemeTokens(":root", SINGLE_BLOCK + 1)).toThrow(
      /Expected 2 ":root" block\(s\)/,
    );
  });

  it("refuses to read a selector that has no block at all", () => {
    expect(() => readThemeTokens(".does-not-exist")).toThrow(
      /No ".does-not-exist" block in/,
    );
  });
});

describe("tokenValue", () => {
  it("throws for a token that was never declared", () => {
    expect(() => tokenValue(new Map(), "--not-declared")).toThrow(
      /Token --not-declared is not declared/,
    );
  });
});

describe("parseRingAlpha", () => {
  it("reads full opacity when the utility carries no modifier", () => {
    expect(parseRingAlpha("outline-ring")).toBe(FULL_OPACITY);
  });

  it("reads the fraction out of an explicit opacity modifier", () => {
    expect(parseRingAlpha("outline-ring/50")).toBeCloseTo(0.5);
  });

  it("throws when the utility is absent altogether", () => {
    expect(() => parseRingAlpha("border-border")).toThrow(
      /No "outline-ring" utility found/,
    );
  });
});

describe("readRingRenderedAlpha", () => {
  it("reads full opacity from the live globals.css (outline-ring, no modifier)", () => {
    expect(readRingRenderedAlpha()).toBe(FULL_OPACITY);
  });
});
