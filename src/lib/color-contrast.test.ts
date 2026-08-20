import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { contrastRatio, relativeLuminance } from "./color-contrast";

const GLOBALS_CSS_PATH = join(process.cwd(), "src", "app", "globals.css");

/** WCAG AA minimum for body text, and the project-wide floor. */
const WCAG_AA_TEXT = 4.5;
const MAX_CONTRAST = 21;

/** Telkom University brand colours, per the university's logo colour codes. */
const TELKOM_MAROON = "#b6252a";
const TELKOM_RED = "#ed1e28";

/** Token pairs that must stay legible in every theme. */
const CONTRAST_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ["--foreground", "--background"],
  ["--primary", "--primary-foreground"],
  ["--primary", "--background"],
  ["--card-foreground", "--card"],
  ["--popover-foreground", "--popover"],
  ["--secondary-foreground", "--secondary"],
  ["--accent-foreground", "--accent"],
  ["--muted-foreground", "--muted"],
  ["--muted-foreground", "--background"],
];

const CSS_COMMENT = /\/\*[\s\S]*?\*\//g;

function readGlobalsCss(): string {
  return readFileSync(GLOBALS_CSS_PATH, "utf8").replace(CSS_COMMENT, "");
}

/** Extracts the custom properties declared in one selector block. */
function readThemeTokens(selector: string): ReadonlyMap<string, string> {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const block = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(
    readGlobalsCss(),
  );
  if (!block) {
    throw new Error(`No "${selector}" block in ${GLOBALS_CSS_PATH}`);
  }
  const tokens = new Map<string, string>();
  for (const line of block[1].split(";")) {
    const declaration = /^\s*(--[\w-]+)\s*:\s*(.+?)\s*$/.exec(line);
    if (declaration) {
      tokens.set(declaration[1], declaration[2]);
    }
  }
  return tokens;
}

function tokenValue(tokens: ReadonlyMap<string, string>, name: string): string {
  const value = tokens.get(name);
  if (!value) {
    throw new Error(`Token ${name} is not declared`);
  }
  return value;
}

const THEMES = [
  { name: "light", selector: ":root", accent: TELKOM_MAROON },
  { name: "dark", selector: ".dark", accent: TELKOM_RED },
] as const;

describe("contrastRatio", () => {
  it("reports the maximum ratio for black on white", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(MAX_CONTRAST);
  });

  it("reports no contrast between a colour and itself", () => {
    expect(contrastRatio(TELKOM_RED, TELKOM_RED)).toBeCloseTo(1);
  });

  it("is symmetric in its arguments", () => {
    const forward = contrastRatio(TELKOM_MAROON, "#ffffff");
    const backward = contrastRatio("#ffffff", TELKOM_MAROON);
    expect(forward).toBeCloseTo(backward);
  });

  it("agrees between hex and oklch notations for the same colour", () => {
    expect(contrastRatio("#ffffff", "oklch(1 0 0)")).toBeCloseTo(1);
  });

  it("rejects a colour notation it cannot evaluate", () => {
    expect(() => contrastRatio("rgb(1 2 3)", "#ffffff")).toThrow(
      /Unsupported colour notation/,
    );
  });
});

describe("relativeLuminance", () => {
  it("returns 0 for black and 1 for white", () => {
    expect(relativeLuminance("#000000")).toBeCloseTo(0);
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1);
  });

  it("reads an oklch lightness back as a plausible luminance", () => {
    const middle = relativeLuminance("oklch(0.5 0 0)");
    expect(middle).toBeGreaterThan(0);
    expect(middle).toBeLessThan(1);
  });

  it("rejects an oklch colour with a missing component", () => {
    expect(() => relativeLuminance("oklch(0.5 0)")).toThrow(
      /Unsupported oklch colour/,
    );
  });

  it("rejects an oklch component that is not a number", () => {
    expect(() => relativeLuminance("oklch(0.5 0 none)")).toThrow(
      /Unsupported oklch component/,
    );
  });

  it("accepts an oklch colour carrying an alpha channel", () => {
    expect(relativeLuminance("oklch(1 0 0 / 10%)")).toBeCloseTo(1);
  });

  it("accepts a percentage lightness", () => {
    expect(relativeLuminance("oklch(100% 0 0)")).toBeCloseTo(1);
  });
});

describe.each(THEMES)("$name theme tokens", ({ selector, accent }) => {
  const tokens = readThemeTokens(selector);

  it("uses a Telkom University brand red as the accent", () => {
    expect(tokenValue(tokens, "--primary")).toBe(accent);
    expect(tokenValue(tokens, "--ring")).toBe(accent);
  });

  it.each(CONTRAST_PAIRS)(
    "holds %s against %s at WCAG AA",
    (foreground, background) => {
      const ratio = contrastRatio(
        tokenValue(tokens, foreground),
        tokenValue(tokens, background),
      );
      expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
    },
  );
});
