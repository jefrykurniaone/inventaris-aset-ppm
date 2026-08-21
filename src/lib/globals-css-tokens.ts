/**
 * Reads design-token facts out of `src/app/globals.css` for
 * `color-contrast.test.ts` to assert on: the custom properties a `:root` or
 * `.dark` block resolves to, and the alpha the `outline-ring` utility in
 * `@layer base` actually renders at. Test-support only — no product code
 * imports this.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

export const GLOBALS_CSS_PATH = join(
  process.cwd(),
  "src",
  "app",
  "globals.css",
);

const CSS_COMMENT = /\/\*[\s\S]*?\*\//g;
const CUSTOM_PROPERTY = /^\s*(--[\w-]+)\s*:\s*(.+?)\s*$/;

const BLOCK_OPEN = "{";
const BLOCK_CLOSE = "}";
const DECLARATION_END = ";";
const TOP_LEVEL_DEPTH = 0;
export const SINGLE_BLOCK = 1;

export function readGlobalsCss(): string {
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
export function collectSelectorBlocks(
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
export function mergeDeclarations(
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
export function readThemeTokens(
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

export function tokenValue(
  tokens: ReadonlyMap<string, string>,
  name: string,
): string {
  const value = tokens.get(name);
  if (!value) {
    throw new Error(`Token ${name} is not declared`);
  }
  return value;
}

/**
 * `--ring`'s focus indicator renders through the `outline-ring` utility in
 * `globals.css`'s `@layer base`, not through a custom property the readers
 * above parse. Reading its opacity modifier here — there is none any more;
 * `outline-ring/50` was replaced by `outline-ring`, see the comment at the
 * top of `globals.css` — keeps the non-text contrast assertion honest about
 * the alpha the ring actually paints at. Asserting the raw token instead
 * would stay green even if the alpha modifier came back, because the token
 * itself was never the problem.
 */
const OUTLINE_RING_UTILITY = /outline-ring(?:\/(\d{1,3}))?\b/;
const ALPHA_PERCENT_DIVISOR = 100;
export const FULL_OPACITY = 1;

/** Pure parser, so every branch is testable against a synthetic string. */
export function parseRingAlpha(css: string): number {
  const match = OUTLINE_RING_UTILITY.exec(css);
  if (!match) {
    throw new Error(`No "outline-ring" utility found in ${GLOBALS_CSS_PATH}`);
  }
  return match[1]
    ? Number.parseInt(match[1], 10) / ALPHA_PERCENT_DIVISOR
    : FULL_OPACITY;
}

export function readRingRenderedAlpha(): number {
  return parseRingAlpha(readGlobalsCss());
}
