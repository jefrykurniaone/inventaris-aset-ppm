import { describe, expect, it } from "vitest";

import {
  buildQrCodeMatrix,
  buildQrModulePath,
  QR_ERROR_CORRECTION_LEVEL,
  QR_QUIET_ZONE_MODULES,
} from "./qr-svg";

/** The smallest QR symbol is 21 × 21 modules, plus the quiet zone on both
 * sides — the floor any encoded value has to clear. */
const SMALLEST_SYMBOL_MODULES = 21;
const MINIMUM_MATRIX_SIZE = SMALLEST_SYMBOL_MODULES + QR_QUIET_ZONE_MODULES * 2;

const SCAN_URL = "http://localhost:3000/a/V1StGXR8Z5jd";

interface ModulePosition {
  readonly x: number;
  readonly y: number;
}

/** Reads the `M<x> <y>h1v1h-1z` commands back out of a path. Split rather than
 * matched with a regular expression — the repository's standing rule after
 * three super-linear-backtracking findings (S8786). */
function modulePositions(path: string): readonly ModulePosition[] {
  return path
    .split("z")
    .filter((command) => command.length > 0)
    .map((command) => {
      const [x, y] = command.slice(1).split("h")[0].split(" ");
      return { x: Number(x), y: Number(y) };
    });
}

describe("buildQrModulePath", () => {
  it("emits nothing for a matrix with no dark module", () => {
    expect(
      buildQrModulePath([
        [false, false],
        [false, false],
      ]),
    ).toBe("");
  });

  it("draws one unit square per dark module, addressed as [y][x]", () => {
    expect(
      buildQrModulePath([
        [false, true],
        [true, false],
      ]),
    ).toBe("M1 0h1v1h-1zM0 1h1v1h-1z");
  });

  it("draws every dark module of a full row", () => {
    expect(buildQrModulePath([[true, true, true]])).toBe(
      "M0 0h1v1h-1zM1 0h1v1h-1zM2 0h1v1h-1z",
    );
  });
});

describe("buildQrCodeMatrix", () => {
  it("encodes at error correction level M, as FR-5.2 requires", () => {
    expect(QR_ERROR_CORRECTION_LEVEL).toBe("M");
  });

  it("surrounds the symbol with the four-module quiet zone the spec asks for", () => {
    expect(QR_QUIET_ZONE_MODULES).toBe(4);
    expect(buildQrCodeMatrix(SCAN_URL).size).toBeGreaterThanOrEqual(
      MINIMUM_MATRIX_SIZE,
    );
  });

  it("leaves the quiet zone empty on every edge", () => {
    const { size, path } = buildQrCodeMatrix(SCAN_URL);
    const positions = modulePositions(path);
    const lastInside = size - QR_QUIET_ZONE_MODULES - 1;

    // A finder pattern sits in each corner of the symbol, so the outermost
    // dark module is exactly the first one past the quiet zone on both axes.
    expect(Math.min(...positions.map((position) => position.x))).toBe(
      QR_QUIET_ZONE_MODULES,
    );
    expect(Math.min(...positions.map((position) => position.y))).toBe(
      QR_QUIET_ZONE_MODULES,
    );
    expect(Math.max(...positions.map((position) => position.x))).toBe(
      lastInside,
    );
    expect(Math.max(...positions.map((position) => position.y))).toBe(
      lastInside,
    );
  });

  it("produces a non-empty path", () => {
    expect(buildQrCodeMatrix(SCAN_URL).path.length).toBeGreaterThan(0);
  });

  it("is deterministic, so two renders of one label agree", () => {
    expect(buildQrCodeMatrix(SCAN_URL)).toEqual(buildQrCodeMatrix(SCAN_URL));
  });

  it("encodes a different token as a different code", () => {
    const other = "http://localhost:3000/a/9bSQ3RxLcE7f";

    expect(buildQrCodeMatrix(SCAN_URL).path).not.toBe(
      buildQrCodeMatrix(other).path,
    );
  });
});
