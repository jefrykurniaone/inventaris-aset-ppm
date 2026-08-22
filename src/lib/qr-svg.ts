import { encode } from "uqr";

/**
 * Server-side QR rendering (PRD FR-5.1, FR-5.2).
 *
 * **This is the only module that touches the QR library.** `uqr` is asked for
 * the module matrix and nothing else; the SVG is assembled here as ordinary
 * React elements by `src/components/QrCode.tsx`. Two reasons that beats
 * calling the library's own `renderSVG`:
 *
 *  - `renderSVG` returns a string, which would have to reach the DOM through
 *    `dangerouslySetInnerHTML`. A QR code is drawn from data this application
 *    owns, so the escape hatch would be safe here — but it is still an escape
 *    hatch on a page whose entire job is to be public, and there is no reason
 *    to open one for a `<path>`.
 *  - Its output carries a `viewBox` and no `width`/`height`, so "sized by
 *    prop" would mean patching a string. Emitting the element directly makes
 *    the size an attribute.
 *
 * Why `uqr` rather than the `qrcode` package: zero runtime dependencies
 * (`qrcode` drags in `yargs`, `pngjs` and `dijkstrajs` for a CLI and a PNG
 * encoder this project never calls), its own TypeScript declarations (`qrcode`
 * needs a separate `@types/qrcode`), MIT, `npm audit` clean, and last
 * published 2026-04 against `qrcode`'s 2024-08 — which is over the two-year
 * staleness line `CLAUDE.md` draws. Pinned exactly at `0.1.3`: a `0.x` minor
 * bump is allowed to break, and the label sheet (#12) prints from this.
 */

/**
 * FR-5.2: level M, recovering 15% data loss. The right point on the curve for
 * a sticker on a moving, handled, occasionally scuffed object — L is too
 * fragile for print and Q/H would grow the module count, and so the printed
 * dot pitch, for no benefit at 63.5 × 38.1 mm.
 */
export const QR_ERROR_CORRECTION_LEVEL = "M";

/**
 * The quiet zone, in modules. ISO/IEC 18004 requires four; `uqr` defaults to
 * one, which scanners tolerate on a screen and frequently do not in print
 * against a label border.
 */
export const QR_QUIET_ZONE_MODULES = 4;

export interface QrCodeMatrix {
  /** Modules per side, quiet zone included. Also the SVG `viewBox` extent, so
   * one module is one user unit and the code scales by attribute alone. */
  readonly size: number;
  /** An SVG path `d` covering every dark module. */
  readonly path: string;
}

/**
 * One `d` attribute for the whole code rather than one `<rect>` per module: a
 * version-3 code at level M is 29 × 29, so the rect form would emit several
 * hundred elements into the HTML of the one page with a 2.5 s budget on 4G.
 *
 * `modules[y][x]`, `true` meaning dark — `uqr`'s documented layout.
 */
export function buildQrModulePath(
  modules: readonly (readonly boolean[])[],
): string {
  const commands: string[] = [];
  for (const [y, row] of modules.entries()) {
    for (const [x, isDark] of row.entries()) {
      if (isDark) {
        commands.push(`M${x} ${y}h1v1h-1z`);
      }
    }
  }
  return commands.join("");
}

/** The matrix for one absolute scan URL (`src/lib/scan-url.ts` builds it). */
export function buildQrCodeMatrix(value: string): QrCodeMatrix {
  const encoded = encode(value, {
    ecc: QR_ERROR_CORRECTION_LEVEL,
    border: QR_QUIET_ZONE_MODULES,
  });
  return { size: encoded.size, path: buildQrModulePath(encoded.data) };
}
