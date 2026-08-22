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

/** `nanoid`'s URL alphabet, which is the whole set a generated token can draw
 * from: letters, digits, `_` and `-`. Nothing in it needs escaping in a path
 * segment, which is why the token can be the URL. */
const QR_TOKEN_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";

/**
 * Whether a string could be a token this application issued (PRD FR-6.1's
 * entry-point validation: `/a/<token>` is an unauthenticated HTTP entry point,
 * so its one parameter is validated before it reaches a query).
 *
 * A scan of the string rather than a regular expression. `^[A-Za-z0-9_-]+$`
 * would be safe here, but an unbounded quantifier abutting `$` is the shape
 * SonarQube `typescript:S8786` flags and this repository has been bitten by
 * three times (#37, #50); the loop is no harder to read and needs no
 * argument.
 *
 * This is a shape check, not authorisation. The token *is* the authorisation,
 * and only the database can say whether one is real — this just refuses the
 * obviously impossible before a query is spent on it, and keeps a hand-crafted
 * path segment out of the query layer.
 */
export function isQrTokenShape(value: string): boolean {
  if (value.length !== QR_TOKEN_LENGTH) {
    return false;
  }
  for (const character of value) {
    if (!QR_TOKEN_ALPHABET.includes(character)) {
      return false;
    }
  }
  return true;
}
