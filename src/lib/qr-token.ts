import { nanoid } from "nanoid";

/**
 * The opaque `qrToken` printed on a label (PRD FR-2.2).
 *
 * Twelve characters of `nanoid`, and nothing else: not the row ID, not a
 * hash of the asset code, not a counter. FR-2.2 calls the token "stable
 * across renumbering", which is only true of a value that carries no
 * information about the row it belongs to — a derived token would have to be
 * reissued whenever whatever it derives from changed, and a printed sticker
 * cannot be reissued.
 *
 * `nanoid` draws from `crypto.getRandomValues`, so this is not
 * `Math.random()` (S2245): the token is the entire authorisation for reading
 * a scan page, so a guessable one would expose the register by enumeration.
 * Twelve characters over `nanoid`'s 64-symbol URL alphabet is ~71 bits, which
 * is why the collision retry in `src/app/(app)/assets/mutations.ts` is a
 * backstop rather than an expected path.
 */
export const QR_TOKEN_LENGTH = 12;

export function generateQrToken(): string {
  return nanoid(QR_TOKEN_LENGTH);
}
