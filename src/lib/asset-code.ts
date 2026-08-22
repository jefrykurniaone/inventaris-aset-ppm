/**
 * Asset code formatting, parsing and sequence arithmetic (PRD FR-2.1):
 * `PPM-<CATEGORY_CODE>-<YEAR>-<SEQUENCE>`, for example `PPM-LAB-2026-0001`,
 * with the sequence per category and per acquisition year, zero-padded to
 * four digits.
 *
 * Everything here is pure. Nothing in this module imports `@/lib/db`, opens a
 * transaction, or reads a clock, so the format rules can be unit-tested on
 * their own. The database side — taking the advisory lock, reading the codes
 * already issued in this namespace, and inserting — lives in
 * `src/app/(app)/assets/mutations.ts`, which imports these functions.
 */

const ASSET_CODE_PREFIX = "PPM";
const ASSET_CODE_SEPARATOR = "-";

/** Four digits, per FR-2.1's `PPM-LAB-2026-0001` worked example. */
export const ASSET_CODE_SEQUENCE_DIGITS = 4;

const SEQUENCE_MODULUS = 10 ** ASSET_CODE_SEQUENCE_DIGITS;

/** The first sequence issued in an empty (category, year) namespace. */
export const FIRST_ASSET_CODE_SEQUENCE = 1;

/** `9999`. Beyond this the code no longer fits its four digits, and the
 * caller must report the namespace exhausted rather than widen the format —
 * labels already printed depend on the width. */
export const MAX_ASSET_CODE_SEQUENCE = SEQUENCE_MODULUS - 1;

/**
 * Anchored, and every quantifier bounded — no nested or ambiguous repetition,
 * so there is no backtracking to blow up on a hostile input (S5852, S8786).
 * The category-code shape matches `categorySchema` in
 * `src/app/(app)/admin/categories/schemas.ts`: 2-4 uppercase letters.
 */
const ASSET_CODE_PATTERN = /^PPM-([A-Z]{2,4})-(\d{4})-(\d{4})$/;

const CATEGORY_CODE_GROUP = 1;
const YEAR_GROUP = 2;
const SEQUENCE_GROUP = 3;
const DECIMAL_RADIX = 10;

export interface AssetCodeParts {
  readonly categoryCode: string;
  readonly acquisitionYear: number;
  readonly sequence: number;
}

/**
 * The `PPM-LAB-2026-` stem every code in one (category, year) namespace
 * shares. This — not the `categoryId`/`acquisitionYear` columns — is what
 * identifies the namespace, because `assetCode` is immutable once issued
 * while both of those columns stay editable. See the comment on
 * `nextAssetCodeSequence` below.
 */
export function assetCodeNamespacePrefix(
  categoryCode: string,
  acquisitionYear: number,
): string {
  const separator = ASSET_CODE_SEPARATOR;
  return `${ASSET_CODE_PREFIX}${separator}${categoryCode}${separator}${acquisitionYear}${separator}`;
}

/**
 * Formats one code. Throws a `RangeError` rather than emitting a malformed
 * code when the sequence will not fit its four digits: a caller that reaches
 * `MAX_ASSET_CODE_SEQUENCE` has a reporting decision to make, and silently
 * wrapping or widening would issue a code that collides with, or cannot be
 * parsed alongside, the labels already printed.
 */
export function formatAssetCode({
  categoryCode,
  acquisitionYear,
  sequence,
}: AssetCodeParts): string {
  if (
    !Number.isInteger(sequence) ||
    sequence < FIRST_ASSET_CODE_SEQUENCE ||
    sequence > MAX_ASSET_CODE_SEQUENCE
  ) {
    throw new RangeError(
      `asset-code: sequence ${sequence} is outside ${FIRST_ASSET_CODE_SEQUENCE}-${MAX_ASSET_CODE_SEQUENCE}.`,
    );
  }

  const padded = String(sequence).padStart(ASSET_CODE_SEQUENCE_DIGITS, "0");
  return assetCodeNamespacePrefix(categoryCode, acquisitionYear) + padded;
}

/** Parses a code back into its three parts, or `null` when it is not one. */
export function parseAssetCode(assetCode: string): AssetCodeParts | null {
  const match = ASSET_CODE_PATTERN.exec(assetCode);
  if (!match) {
    return null;
  }

  return {
    categoryCode: match[CATEGORY_CODE_GROUP],
    acquisitionYear: Number.parseInt(match[YEAR_GROUP], DECIMAL_RADIX),
    sequence: Number.parseInt(match[SEQUENCE_GROUP], DECIMAL_RADIX),
  };
}

/** The sequence half of `parseAssetCode`, or `null` for anything that is not
 * a well-formed asset code. */
export function parseAssetCodeSequence(assetCode: string): number | null {
  return parseAssetCode(assetCode)?.sequence ?? null;
}

/**
 * The next sequence for a namespace, given every code already issued in it.
 *
 * Highest-issued plus one, never a count and never a gap-filler: a sequence
 * is retired with the label it was printed on, so a soft-deleted row — and
 * even a row deleted outright — must not free its number for reuse. A code
 * this function cannot parse is ignored rather than treated as zero, so one
 * hand-written row cannot drag the whole namespace back to the start.
 */
export function nextAssetCodeSequence(
  issuedCodes: readonly string[],
): number | null {
  let highest = 0;
  for (const code of issuedCodes) {
    const sequence = parseAssetCodeSequence(code);
    if (sequence !== null && sequence > highest) {
      highest = sequence;
    }
  }

  const next = highest + 1;
  return next > MAX_ASSET_CODE_SEQUENCE ? null : next;
}

/**
 * `hash & 0xffffffff` of `<categoryId>:<year>`, FNV-1a, narrowed to a signed
 * 32-bit integer so it can be handed straight to Postgres'
 * `pg_advisory_xact_lock(int4, int4)`.
 *
 * Computed here rather than with Postgres' own `hashtext()` because
 * `hashtext` is an undocumented internal whose output has changed between
 * major versions; this one is pinned by the unit test beside it. A hash
 * collision between two different namespaces costs nothing but a moment of
 * needless serialisation — the correctness backstop is the `@unique` index on
 * `Asset.assetCode`, not this key.
 */
const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/**
 * The `classid` half of `pg_advisory_xact_lock(int4, int4)`. Advisory locks
 * share one global space per database, so this fixed, arbitrary namespace
 * keeps asset-code locks from ever colliding with a lock some other part of
 * the application takes on an unrelated key that happens to hash the same.
 * `0x41535345` is ASCII `ASSE`.
 */
export const ASSET_CODE_LOCK_NAMESPACE = 0x41535345;

export function assetCodeLockKey(
  categoryId: string,
  acquisitionYear: number,
): number {
  const source = `${categoryId}:${acquisitionYear}`;
  let hash = FNV_OFFSET_BASIS;
  // `charCodeAt`, not `codePointAt`: the latter is typed `number | undefined`
  // and would need a `?? 0` fallback that no input can reach, leaving an
  // untestable branch behind. Every id and year here is ASCII, and the hash
  // only has to be deterministic, not Unicode-aware.
  for (const character of source) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, FNV_PRIME);
  }
  return hash | 0;
}
