import { describe, expect, it } from "vitest";

import {
  contrastRatio,
  luminanceFromLinearRgb,
  relativeLuminance,
  toLinearRgb,
} from "./color-contrast";
import { compositeOver, contrastFromLuminances } from "./color-contrast-alpha";
import {
  readRingRenderedAlpha,
  readThemeTokens,
  tokenValue,
} from "./globals-css-tokens";

/** WCAG 2.1 SC 1.4.3 minimum for text: body copy and any text-bearing surface. */
const WCAG_AA_TEXT = 4.5;
/**
 * WCAG 2.1 SC 1.4.11 minimum for a non-text UI indicator — a focus ring is
 * the case in this file. Deliberately lower than `WCAG_AA_TEXT`: SC 1.4.11
 * does not require text-grade contrast for something that is a shape, not a
 * glyph.
 */
const WCAG_AA_NON_TEXT = 3;
const MAX_CONTRAST = 21;

/** Telkom University brand colours, per the university's logo colour codes. */
const TELKOM_MAROON = "#b6252a";
const TELKOM_RED = "#ed1e28";

/** Token pairs that must stay legible (WCAG_AA_TEXT) in every theme. */
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
  ["--destructive", "--destructive-foreground"],
];

/**
 * Non-text indicators, checked against `WCAG_AA_NON_TEXT` instead.
 * `--ring` renders at full opacity (the `outline-ring/50` alpha modifier
 * shadcn ships by default was removed from `globals.css` — see the comment
 * at the top of that file): halved, the ring fails 3:1 in both themes, and
 * no colour close to the brand red survives being blended 50% toward either
 * theme's background and still clearing 3:1, so raising the token instead
 * of dropping the alpha was not a workable alternative. Asserted below at
 * its actual rendered alpha (see `readRingRenderedAlpha`), not at full
 * opacity, via `color-contrast-alpha.ts`'s compositing.
 */
const NON_TEXT_CONTRAST_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ["--ring", "--background"],
];

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

/**
 * `--ring` is asserted below at its actual rendered alpha, which relies on
 * `contrastRatio`/`relativeLuminance` handling opaque hex and oklch colours
 * correctly and on alpha-bearing colours never being silently treated as
 * opaque. This block confirms both, independently of the design tokens:
 * every expected number here was computed from the public WCAG
 * relative-luminance formula and the public OKLab->sRGB matrices (Björn
 * Ottosson), not by reading `color-contrast.ts`, so a match is real
 * evidence the module is right rather than the test mirroring the
 * implementation. `color-contrast-alpha.test.ts` separately verifies the
 * compositing pipeline the ring assertion also depends on.
 */
describe("alpha handling is verified before it is relied on", () => {
  it("matches independently computed contrast ratios for opaque colours", () => {
    // The pre-fix dark --destructive value: oklch(0.704 0.191 22.216)
    // against white. Kept as a literal (not read from globals.css) so this
    // stays a pure check of the maths, unaffected by future token changes.
    expect(contrastRatio("oklch(0.704 0.191 22.216)", "#ffffff")).toBeCloseTo(
      2.8922,
      3,
    );
    expect(contrastRatio("oklch(0.577 0.245 27.325)", "#ffffff")).toBeCloseTo(
      4.7647,
      3,
    );
    expect(contrastRatio(TELKOM_MAROON, "#ffffff")).toBeCloseTo(6.3887, 3);
    expect(contrastRatio(TELKOM_RED, "#ffffff")).toBeCloseTo(4.3593, 3);
    expect(contrastRatio(TELKOM_RED, "#0a0a0a")).toBeCloseTo(4.5416, 3);
    // oklch(0.145 0 0) is the --background value dark mode actually ships;
    // confirms the oklch parser and the hex parser agree on the same colour.
    expect(contrastRatio("oklch(0.145 0 0)", "#0a0a0a")).toBeCloseTo(1, 2);
  });

  it("rejects every alpha-bearing notation the tokens could use, rather than discarding the alpha", () => {
    const alphaBearingColours = [
      "#ffffff1a",
      "#fff1",
      "oklch(1 0 0 / 10%)",
      "oklch(1 0 0/50%)",
      "OKLCH(1 0 0 / 50%)",
    ];
    for (const colour of alphaBearingColours) {
      expect(() => relativeLuminance(colour)).toThrow(
        /carries an alpha channel/,
      );
    }
  });
});

describe.each(THEMES)("$name theme tokens", ({ selector, accent }) => {
  const tokens = readThemeTokens(selector);

  it("uses a Telkom University brand red as the accent", () => {
    expect(tokenValue(tokens, "--primary")).toBe(accent);
    expect(tokenValue(tokens, "--ring")).toBe(accent);
  });

  it.each(CONTRAST_PAIRS)(
    "holds %s against %s at WCAG AA for text (SC 1.4.3, 4.5:1)",
    (foreground, background) => {
      const ratio = contrastRatio(
        tokenValue(tokens, foreground),
        tokenValue(tokens, background),
      );
      expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
    },
  );

  it.each(NON_TEXT_CONTRAST_PAIRS)(
    "holds %s against %s at WCAG AA for a non-text indicator (SC 1.4.11, 3:1), at its rendered alpha",
    (foreground, background) => {
      const alpha = readRingRenderedAlpha();
      const backgroundLinear = toLinearRgb(tokenValue(tokens, background));
      const rendered = compositeOver(
        toLinearRgb(tokenValue(tokens, foreground)),
        backgroundLinear,
        alpha,
      );
      const ratio = contrastFromLuminances(
        luminanceFromLinearRgb(rendered),
        luminanceFromLinearRgb(backgroundLinear),
      );
      expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_NON_TEXT);
    },
  );
});
