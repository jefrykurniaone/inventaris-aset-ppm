/**
 * WCAG 2.1 relative luminance and contrast ratio, for the two CSS colour
 * notations used by the design tokens in `src/app/globals.css`: `#rrggbb`
 * and `oklch(L C H)`.
 *
 * Accessibility is a binding requirement (WCAG AA, 4.5:1), so the theme is
 * checked by a test rather than by eye. See `color-contrast.test.ts`.
 *
 * Only opaque colours are accepted. A translucent colour has no luminance of
 * its own — it has one per backdrop — so `#rrggbbaa`, `#rgba` and
 * `oklch(L C H / A)` are rejected instead of being silently treated as
 * opaque. `globals.css` ships translucent tokens (`--border`, `--input`), and
 * reading them as opaque overstates their contrast by more than an order of
 * magnitude. Compositing is deliberately not implemented here: it needs a
 * backdrop, which only the caller knows.
 */

/** Linear-light sRGB, each channel in the range 0..1. */
export type LinearRgb = readonly [number, number, number];

const HEX_PATTERN = /^#([0-9a-f]{6})$/i;
/** `#rgba` and `#rrggbbaa` — the alpha-carrying hex forms. */
const HEX_ALPHA_PATTERN = /^#(?:[0-9a-f]{4}|[0-9a-f]{8})$/i;
const OKLCH_PATTERN = /^oklch\(([^)]*)\)$/i;
const ALPHA_SEPARATOR = "/";

const HEX_RADIX = 16;
const HEX_CHANNEL_LENGTH = 2;
const HEX_CHANNEL_COUNT = 3;
const SRGB_MAX = 255;

const SRGB_TRANSFER_THRESHOLD = 0.04045;
const SRGB_TRANSFER_DIVISOR = 12.92;
const SRGB_TRANSFER_OFFSET = 0.055;
const SRGB_TRANSFER_SCALE = 1.055;
const SRGB_TRANSFER_EXPONENT = 2.4;

const LUMINANCE_WEIGHT_RED = 0.2126;
const LUMINANCE_WEIGHT_GREEN = 0.7152;
const LUMINANCE_WEIGHT_BLUE = 0.0722;
const CONTRAST_OFFSET = 0.05;

const OKLCH_COMPONENT_COUNT = 3;
const PERCENT_DIVISOR = 100;
const DEGREES_TO_RADIANS = Math.PI / 180;
const CUBED = 3;

/** Coefficients of the OKLab -> LMS' inverse transform (Björn Ottosson). */
const OKLAB_TO_LMS = [
  [1, 0.3963377774, 0.2158037573],
  [1, -0.1055613458, -0.0638541728],
  [1, -0.0894841775, -1.291485548],
] as const;

/** Coefficients of the LMS -> linear sRGB transform (Björn Ottosson). */
const LMS_TO_LINEAR_SRGB = [
  [4.0767416621, -3.3077115913, 0.2309699292],
  [-1.2684380046, 2.6097574011, -0.3413193965],
  [-0.0041960863, -0.7034186147, 1.707614701],
] as const;

function clampToUnit(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

function srgbChannelToLinear(channel: number): number {
  if (channel <= SRGB_TRANSFER_THRESHOLD) {
    return channel / SRGB_TRANSFER_DIVISOR;
  }
  const normalised = (channel + SRGB_TRANSFER_OFFSET) / SRGB_TRANSFER_SCALE;
  return normalised ** SRGB_TRANSFER_EXPONENT;
}

function parseHex(match: RegExpExecArray): LinearRgb {
  const digits = match[1];
  const channels: number[] = [];
  for (let index = 0; index < HEX_CHANNEL_COUNT; index += 1) {
    const start = index * HEX_CHANNEL_LENGTH;
    const pair = digits.slice(start, start + HEX_CHANNEL_LENGTH);
    channels.push(
      srgbChannelToLinear(Number.parseInt(pair, HEX_RADIX) / SRGB_MAX),
    );
  }
  return [channels[0], channels[1], channels[2]];
}

function parseNumber(token: string): number {
  const value = token.endsWith("%")
    ? Number.parseFloat(token) / PERCENT_DIVISOR
    : Number.parseFloat(token);
  if (Number.isNaN(value)) {
    throw new Error(`Unsupported oklch component: "${token}"`);
  }
  return value;
}

function parseOklch(match: RegExpExecArray): LinearRgb {
  const parts = match[1].split(/[\s,]+/).filter(Boolean);
  if (parts.length !== OKLCH_COMPONENT_COUNT) {
    throw new Error(`Unsupported oklch colour: "${match[0]}"`);
  }
  const [lightness, chroma, hue] = parts.map(parseNumber);
  const hueRadians = hue * DEGREES_TO_RADIANS;
  const labA = chroma * Math.cos(hueRadians);
  const labB = chroma * Math.sin(hueRadians);
  const lms = OKLAB_TO_LMS.map(
    ([kL, kA, kB]) => (kL * lightness + kA * labA + kB * labB) ** CUBED,
  );
  const linear = LMS_TO_LINEAR_SRGB.map(([kL, kM, kS]) =>
    clampToUnit(kL * lms[0] + kM * lms[1] + kS * lms[2]),
  );
  return [linear[0], linear[1], linear[2]];
}

function rejectAlpha(color: string): never {
  throw new Error(
    `Colour "${color}" carries an alpha channel. Contrast is defined only for ` +
      `opaque colours; composite it over its backdrop and pass the result.`,
  );
}

/**
 * Converts a supported, fully opaque CSS colour string to linear-light sRGB.
 *
 * Throws on a colour carrying an alpha component, in either notation.
 */
export function toLinearRgb(color: string): LinearRgb {
  const value = color.trim();
  if (HEX_ALPHA_PATTERN.test(value)) {
    rejectAlpha(color);
  }
  const hexMatch = HEX_PATTERN.exec(value);
  if (hexMatch) {
    return parseHex(hexMatch);
  }
  const oklchMatch = OKLCH_PATTERN.exec(value);
  if (!oklchMatch) {
    throw new Error(`Unsupported colour notation: "${color}"`);
  }
  if (oklchMatch[1].includes(ALPHA_SEPARATOR)) {
    rejectAlpha(color);
  }
  return parseOklch(oklchMatch);
}

/** WCAG 2.1 relative luminance, 0 for black and 1 for white. */
export function relativeLuminance(color: string): number {
  const [red, green, blue] = toLinearRgb(color);
  return (
    LUMINANCE_WEIGHT_RED * red +
    LUMINANCE_WEIGHT_GREEN * green +
    LUMINANCE_WEIGHT_BLUE * blue
  );
}

/** WCAG 2.1 contrast ratio between two colours, from 1 to 21. */
export function contrastRatio(foreground: string, background: string): number {
  const first = relativeLuminance(foreground);
  const second = relativeLuminance(background);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + CONTRAST_OFFSET) / (darker + CONTRAST_OFFSET);
}
