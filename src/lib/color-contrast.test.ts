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
const CUSTOM_PROPERTY = /^\s*(--[\w-]+)\s*:\s*(.+?)\s*$/;

const BLOCK_OPEN = "{";
const BLOCK_CLOSE = "}";
const DECLARATION_END = ";";
const TOP_LEVEL_DEPTH = 0;
const SINGLE_BLOCK = 1;

function readGlobalsCss(): string {
  return readFileSync(GLOBALS_CSS_PATH, "utf8").replace(CSS_COMMENT, "");
}

interface OpenBlock {
  readonly prelude: string;
  readonly bodyStart: number;
  readonly depth: number;
}

function bodyIfSelectorMatches(
  css: string,
  selector: string,
  closed: OpenBlock | undefined,
  parent: OpenBlock | undefined,
  closeIndex: number,
): string | null {
  if (!closed || closed.prelude !== selector) {
    return null;
  }
  if (closed.depth !== TOP_LEVEL_DEPTH) {
    throw new Error(
      `Selector "${selector}" is nested inside "${parent?.prelude ?? "an at-rule"}". ` +
        `This reader does not evaluate at-rules, so it cannot tell which ` +
        `declarations apply. Flatten the block or teach the reader about it.`,
    );
  }
  return css.slice(closed.bodyStart, closeIndex);
}

/**
 * Bodies of every top-level block whose prelude is exactly `selector`, in
 * document order. Brace-aware, so a block containing nested rules (`@layer
 * base { … }`) is skipped rather than mis-parsed, and a matching selector
 * found inside an at-rule throws instead of silently hijacking the read.
 */
function collectSelectorBlocks(
  css: string,
  selector: string,
): readonly string[] {
  const bodies: string[] = [];
  const stack: OpenBlock[] = [];
  let tokenStart = 0;
  for (let index = 0; index < css.length; index += 1) {
    const char = css[index];
    if (char === BLOCK_OPEN) {
      stack.push({
        prelude: css.slice(tokenStart, index).trim(),
        bodyStart: index + 1,
        depth: stack.length,
      });
    } else if (char === BLOCK_CLOSE) {
      const closed = stack.pop();
      const body = bodyIfSelectorMatches(
        css,
        selector,
        closed,
        stack.at(-1),
        index,
      );
      if (body !== null) {
        bodies.push(body);
      }
    } else if (char !== DECLARATION_END) {
      continue;
    }
    // `{`, `}` and `;` all end whatever preceded them, so the next prelude
    // starts here. Without this, a prelude would swallow the declarations
    // above it.
    tokenStart = index + 1;
  }
  return bodies;
}

/** Merges block bodies in document order, so the last declaration wins. */
function mergeDeclarations(
  bodies: readonly string[],
): ReadonlyMap<string, string> {
  const tokens = new Map<string, string>();
  for (const body of bodies) {
    for (const line of body.split(DECLARATION_END)) {
      const declaration = CUSTOM_PROPERTY.exec(line);
      if (declaration) {
        tokens.set(declaration[1], declaration[2]);
      }
    }
  }
  return tokens;
}

/**
 * Custom properties a selector resolves to, merged across every one of its
 * blocks. `expectedBlocks` has to be stated, so a block appearing that this
 * gate was not told about fails loudly rather than being read past.
 */
function readThemeTokens(
  selector: string,
  expectedBlocks: number = SINGLE_BLOCK,
): ReadonlyMap<string, string> {
  const bodies = collectSelectorBlocks(readGlobalsCss(), selector);
  if (bodies.length === 0) {
    throw new Error(`No "${selector}" block in ${GLOBALS_CSS_PATH}`);
  }
  if (bodies.length !== expectedBlocks) {
    throw new Error(
      `Expected ${expectedBlocks} "${selector}" block(s) in ${GLOBALS_CSS_PATH}, ` +
        `found ${bodies.length}. Later blocks override earlier ones, so the ` +
        `merge has to be intentional: state the new count here once it is.`,
    );
  }
  return mergeDeclarations(bodies);
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

  it("rejects an oklch colour carrying an alpha channel", () => {
    expect(() => relativeLuminance("oklch(1 0 0 / 10%)")).toThrow(
      /carries an alpha channel/,
    );
  });

  it("rejects a hex colour carrying an alpha channel", () => {
    expect(() => relativeLuminance("#ffffff1a")).toThrow(
      /carries an alpha channel/,
    );
    expect(() => relativeLuminance("#fff1")).toThrow(
      /carries an alpha channel/,
    );
  });

  it("accepts a percentage lightness", () => {
    expect(relativeLuminance("oklch(100% 0 0)")).toBeCloseTo(1);
  });
});

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
