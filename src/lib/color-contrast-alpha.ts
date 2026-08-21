/**
 * Alpha compositing for a caller of `color-contrast.ts` that needs it.
 * `color-contrast.ts` deliberately does not implement this (see its module
 * doc): it has no way to know a colour's backdrop. This module is that
 * caller-side piece — used by `color-contrast.test.ts` to measure `--ring`
 * at the alpha it actually renders at, rather than at full opacity.
 *
 * CSS/Canvas "over" compositing blends in gamma-encoded sRGB, not linear
 * light, so the transfer curve `toLinearRgb` applies has to be inverted
 * before blending and reapplied after.
 */

import type { LinearRgb } from "./color-contrast";

const GAMMA_TRANSFER_THRESHOLD = 0.04045;
const LINEAR_TRANSFER_THRESHOLD = 0.0031308;
const TRANSFER_LINEAR_SCALE = 12.92;
const TRANSFER_GAMMA_OFFSET = 0.055;
const TRANSFER_GAMMA_SCALE = 1.055;
const TRANSFER_EXPONENT = 2.4;

function linearChannelToGamma(channel: number): number {
  if (channel <= LINEAR_TRANSFER_THRESHOLD) {
    return channel * TRANSFER_LINEAR_SCALE;
  }
  return (
    TRANSFER_GAMMA_SCALE * channel ** (1 / TRANSFER_EXPONENT) -
    TRANSFER_GAMMA_OFFSET
  );
}

function gammaChannelToLinear(channel: number): number {
  if (channel <= GAMMA_TRANSFER_THRESHOLD) {
    return channel / TRANSFER_LINEAR_SCALE;
  }
  return (
    ((channel + TRANSFER_GAMMA_OFFSET) / TRANSFER_GAMMA_SCALE) **
    TRANSFER_EXPONENT
  );
}

/**
 * The colour a browser actually paints for `foreground` (opaque) drawn at
 * `alpha` over `background` (opaque) — e.g. what `outline-ring/50` used to
 * render.
 */
export function compositeOver(
  foreground: LinearRgb,
  background: LinearRgb,
  alpha: number,
): LinearRgb {
  const blendChannel = (fgChannel: number, bgChannel: number): number => {
    const blendedGamma =
      linearChannelToGamma(fgChannel) * alpha +
      linearChannelToGamma(bgChannel) * (1 - alpha);
    return gammaChannelToLinear(blendedGamma);
  };
  return [
    blendChannel(foreground[0], background[0]),
    blendChannel(foreground[1], background[1]),
    blendChannel(foreground[2], background[2]),
  ];
}

/** WCAG 2.1's contrast-ratio formula, from two already-computed luminances. */
const WCAG_CONTRAST_OFFSET = 0.05;

export function contrastFromLuminances(first: number, second: number): number {
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + WCAG_CONTRAST_OFFSET) / (darker + WCAG_CONTRAST_OFFSET);
}
