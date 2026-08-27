/**
 * Rejects text-encoding damage before it reaches a commit or a merge.
 *
 * Three failure modes, all silent when they happen and all unrecoverable once
 * committed:
 *
 *   1. Double-encoded UTF-8 ("mojibake"). A UTF-8 file decoded with a legacy
 *      single-byte codepage and re-encoded as UTF-8. An em dash (U+2014, bytes
 *      `E2 80 94`) becomes the eight-byte sequence `C3 A2 E2 82 AC E2 80 9D`.
 *      The file is then *valid* UTF-8 holding the wrong characters, so no
 *      decoder undoes it, no editor warns, and `git diff` shows a plausible
 *      change.
 *   2. A UTF-8 byte-order mark. Breaks shebang lines and several JSON parsers,
 *      and `sonar.sourceEncoding=UTF-8` does not imply one is wanted.
 *   3. U+FFFD replacement characters, which mean bytes were already discarded
 *      by a lossy decode. Only the original source can restore those.
 *
 * On Windows the cause is a read-modify-write round trip through Windows
 * PowerShell 5.1. Its `Get-Content` decodes with the ANSI codepage, and its
 * `-Encoding utf8` means "with a BOM" (`utf8NoBOM` exists only in PowerShell
 * 7+). Neither default alone destroys a file — `Get-Content` piped to
 * `Set-Content` round-trips losslessly, and piped to a bare `Out-File` it
 * produces obviously broken UTF-16. It is the asymmetric pair, an ANSI read
 * with a forced-UTF-8 write, that produces damage plausible enough to commit.
 * Change file content with an editor, not with a shell pipeline.
 *
 * Run it over specific files, which is how `lint-staged` invokes it:
 *
 *     npx tsx scripts/check-encoding.ts docs/prd.md
 *
 * Run it over every tracked file, which is how CI invokes it:
 *
 *     npm run check:encoding
 *
 * A non-zero exit code means at least one file is damaged. Set
 * `SKIP_ENCODING_CHECK=1` to bypass, matching the global git hook's variable.
 *
 * This file cites the damaged byte sequences as numeric literals rather than
 * as text on purpose: it stays pure ASCII and so cannot be corrupted by the
 * problem it detects, and it cannot report a finding against itself. A
 * document that needs to discuss mojibake should quote the bytes in hex for
 * the same reason.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

/** `EF BB BF`. Compared against the first three bytes of a file. */
const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf]);

/**
 * A file is treated as binary when a NUL appears early in it, the same
 * heuristic `grep -I` and `git diff` use. Checking a prefix rather than the
 * whole file keeps this cheap on large assets.
 */
const NUL_BYTE = 0x00;
const BINARY_SNIFF_LIMIT = 8_000;

const LINE_FEED = 0x0a;
const FIRST_LINE = 1;
const EXIT_DAMAGE_FOUND = 1;

/** One byte sequence that only occurs in damaged text, and what it means. */
interface DamagePattern {
  readonly bytes: Buffer;
  readonly what: string;
}

/**
 * `C3 A2 E2 82 AC` is the first five bytes of every double-encoded character
 * in the `U+2013`-`U+201D` band, which covers the en dash, the em dash and
 * both pairs of curly quotes. Matching the shared prefix catches the whole
 * family with one pattern instead of six.
 */
const DAMAGE_PATTERNS: readonly DamagePattern[] = [
  {
    bytes: Buffer.from([0xc3, 0xa2, 0xe2, 0x82, 0xac]),
    what: "double-encoded UTF-8 (a dash or a curly quote)",
  },
  {
    bytes: Buffer.from([0xc3, 0x83, 0xc2, 0xa2]),
    what: "triple-encoded UTF-8",
  },
  {
    bytes: Buffer.from([0xc3, 0x82, 0xc2, 0xa0]),
    what: "double-encoded non-breaking space",
  },
  {
    bytes: Buffer.from([0xef, 0xbf, 0xbd]),
    what: "U+FFFD replacement character, so bytes were already lost",
  },
];

interface Finding {
  readonly file: string;
  readonly line: number;
  readonly message: string;
}

function isBinary(content: Buffer): boolean {
  const limit = Math.min(content.length, BINARY_SNIFF_LIMIT);
  return content.subarray(0, limit).includes(NUL_BYTE);
}

/** One-based line number of a byte offset, for editor-clickable output. */
function lineOfOffset(content: Buffer, offset: number): number {
  let line = FIRST_LINE;
  for (const byte of content.subarray(0, offset)) {
    if (byte === LINE_FEED) {
      line += 1;
    }
  }
  return line;
}

function findPattern(
  file: string,
  content: Buffer,
  pattern: DamagePattern,
): Finding[] {
  const findings: Finding[] = [];
  let offset = content.indexOf(pattern.bytes);
  while (offset !== -1) {
    findings.push({
      file,
      line: lineOfOffset(content, offset),
      message: pattern.what,
    });
    offset = content.indexOf(pattern.bytes, offset + pattern.bytes.length);
  }
  return findings;
}

function readIfPresent(file: string): Buffer | null {
  try {
    return readFileSync(file);
  } catch (error) {
    // lint-staged can pass a path that a later hook has already removed. That
    // is not damage, so it must not fail the run — but it is worth printing,
    // because a genuine permission error looks identical from here.
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(`check-encoding: could not read ${file}: ${reason}`);
    return null;
  }
}

function checkFile(file: string): Finding[] {
  const content = readIfPresent(file);
  if (content === null || content.length === 0 || isBinary(content)) {
    return [];
  }

  const findings: Finding[] = [];
  if (content.subarray(0, UTF8_BOM.length).equals(UTF8_BOM)) {
    findings.push({
      file,
      line: FIRST_LINE,
      message: "UTF-8 byte-order mark, so write this file without a BOM",
    });
  }
  for (const pattern of DAMAGE_PATTERNS) {
    findings.push(...findPattern(file, content, pattern));
  }
  return findings;
}

/**
 * The paths given as arguments, or every tracked file when there are none.
 * `-z` makes git emit raw NUL-separated paths, so `core.quotepath` cannot turn
 * a non-ASCII filename into an escaped form that `readFileSync` would miss.
 */
function filesToCheck(): string[] {
  const fromArguments = process.argv.slice(2);
  if (fromArguments.length > 0) {
    return fromArguments;
  }
  const tracked = execFileSync("git", ["ls-files", "-z"]);
  return tracked
    .toString("utf8")
    .split("\0")
    .filter((path) => path.length > 0);
}

function report(findings: readonly Finding[]): void {
  const ordered = [...findings].sort(
    (left, right) =>
      left.file.localeCompare(right.file) || left.line - right.line,
  );
  console.error("check-encoding: text encoding damage found\n");
  for (const finding of ordered) {
    console.error(`${finding.file}:${finding.line}: ${finding.message}`);
  }
  console.error(
    "\nRepair these from the original text, then stage them again. Do not" +
      " hand-type a replacement character unless the original is confirmed:" +
      " guessing which one was there rewrites meaning.",
  );
}

function main(): void {
  if (process.env.SKIP_ENCODING_CHECK) {
    console.warn("check-encoding: SKIP_ENCODING_CHECK is set, not checking");
    return;
  }

  const findings = filesToCheck().flatMap((file) => checkFile(file));
  if (findings.length === 0) {
    return;
  }

  report(findings);
  process.exitCode = EXIT_DAMAGE_FOUND;
}

main();
