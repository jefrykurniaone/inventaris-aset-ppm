import { buildQrCodeMatrix } from "@/lib/qr-svg";

interface QrCodeProps {
  /** The absolute URL to encode — always built by `buildScanUrl` (FR-5.1). */
  readonly value: string;
  /** Rendered edge length in CSS pixels. The matrix is emitted at one user
   * unit per module and scaled by `viewBox`, so this is the only size knob and
   * the code stays crisp at any of them (FR-5.2). */
  readonly sizePx: number;
  /** `alt` text. The code carries no visible text, so a screen reader has
   * nothing else to go on. */
  readonly label: string;
}

/**
 * A QR code, server-rendered as SVG (PRD FR-5.1, FR-5.2). Ships no client
 * JavaScript, which is what lets the public scan page render with scripting
 * switched off.
 *
 * Shared deliberately: the asset detail page shows one, and the A4 label sheet
 * (#12) prints a grid of them at a different `sizePx`.
 *
 * The two colours are literal black and white rather than theme tokens. A
 * scanner needs a dark-on-light symbol at high contrast; inverting it in dark
 * mode would produce a code that half the phones in the building refuse to
 * read, and a printed label has no theme at all. 21:1 contrast, so WCAG AA is
 * met in both themes by the same values.
 */
export function QrCode({ value, sizePx, label }: Readonly<QrCodeProps>) {
  const { size, path } = buildQrCodeMatrix(value);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={label}
      width={sizePx}
      height={sizePx}
      viewBox={`0 0 ${size} ${size}`}
      shapeRendering="crispEdges"
    >
      <rect width={size} height={size} fill="#ffffff" />
      <path d={path} fill="#000000" />
    </svg>
  );
}
