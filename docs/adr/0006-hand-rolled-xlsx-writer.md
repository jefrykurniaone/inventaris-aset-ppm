# 0006 — A hand-rolled XLSX writer instead of an npm spreadsheet library

- **Status**: Accepted
- **Date**: 2026-08-22
- **Deciders**: Jefry Kurniawan

## Context

Issue #14 asks for an XLSX export of the filtered asset list, and states the reason for XLSX over
CSV plainly: every recipient opens it in Excel, and a CSV carrying Indonesian decimal separators
becomes a support problem immediately. The ticket also asks, before a library is chosen, for its
licence, maintenance status and known CVEs to be checked — noting that "the popular options in this
space have a history of advisories".

The feature set actually needed is small: one sheet, a frozen and styled header row, per-column
widths, three number formats (general text, an integer with no thousands separator, an IDR currency
format), real dates, and generation that streams rather than holding a whole workbook in memory.
Nothing is read back; nothing is parsed; there are no formulas, no charts, no images, no second
sheet.

Two other constraints were in play. `CLAUDE.md` refuses a dependency "unmaintained for two or more
years without written justification" and asks for zero vulnerabilities. And this repository has
already taken the zero-dependency answer twice where the feature set was small — `uqr` aside, the
QR SVG rendering in `src/lib/qr-svg.ts` and the dashboard charts in #13 are both hand-written.

## Decision

**The export writes the `.xlsx` package itself, with no new dependency.** An `.xlsx` file is a ZIP
archive of six XML parts, and both halves are written here:

- `src/lib/xlsx-zip.ts` — CRC-32, ZIP local file headers, central directory, end-of-central-directory
  record, and the incremental deflate that gives the export its memory profile. Compression is
  Node's built-in `node:zlib`.
- `src/lib/xlsx-cells.ts`, `src/lib/xlsx-parts.ts`, `src/lib/xlsx-writer.ts` — SpreadsheetML for the
  cells and the five fixed parts, and the assembly into a `ReadableStream`.

Rows are pulled from an async iterable and fed through one deflate stream as they arrive, so the
uncompressed worksheet XML — the only part that grows with the register — never exists as a single
value.

## Consequences

**Easier.** No new supply-chain surface at all: nothing to audit, nothing to patch, no transitive
advisory arriving through a package that no longer has a maintainer to release the fix. The
streaming requirement is satisfied by construction rather than by hoping a library's streaming mode
behaves. Total addition is roughly 450 lines, all of it covered by unit tests that unzip the
produced bytes and assert on the worksheet XML.

**Harder.** The repository now owns a small piece of the OOXML and ZIP specifications. There is no
ZIP64 (so no archive above 4 GB, which the twenty-thousand-row cap in `src/lib/asset-export.ts`
keeps unreachable), no shared-string table, no second sheet, no formulas, and no reading. Anything
past that feature set is new code here rather than a library upgrade.

**Foreclosed.** Nothing permanently: the writer sits behind `createXlsxStream`, and swapping in a
library later means replacing four files whose only caller is
`src/app/(app)/assets/export/workbook.ts`.

**Verification the tests cannot do.** Unit tests prove the archive inflates and that the worksheet
XML declares the frozen pane, the widths, the IDR number format and the date serials. They do not
prove Microsoft Excel accepts the file. That has to be checked by opening a real download once.

## Alternatives considered

### `exceljs` — rejected on maintenance and unfixable transitive advisories

MIT licensed, 11.5 million weekly downloads, and the obvious default. Latest published version is
4.4.0; the npm registry's own `time.modified` for the package is 2024-12-20 and the release itself
is around three years old. Snyk classes the maintenance status as **Inactive**: no new version in
the past twelve months, and no pull-request activity or issue-status change in the repository in the
past month. Issue [exceljs/exceljs#2969](https://github.com/exceljs/exceljs/issues/2969) —
"Is this project still maintained? Any plans for a new release?" — is open and unanswered.

Snyk reports **no direct vulnerability** in the package. The problem is what it drags in and cannot
release a fix for:

| Transitive dependency | Advisory | Tracking issue |
|---|---|---|
| `glob` 7.x | CVE-2025-64756 — command injection | [#3006](https://github.com/exceljs/exceljs/issues/3006) |
| `tmp` ^0.2.0 | GHSA-9r2w-394v-53qc — path traversal | [#3055](https://github.com/exceljs/exceljs/issues/3055) |
| `uuid` v3/v5/v6 | GHSA-w5hq-g745-h8pq — missing buffer bounds check | [#3041](https://github.com/exceljs/exceljs/issues/3041) |
| `brace-expansion` 1.1.11 (via `archiver` → `archiver-utils` → `glob` → `minimatch`) | ReDoS | [#2984](https://github.com/exceljs/exceljs/issues/2984), [#2829](https://github.com/exceljs/exceljs/issues/2829) |

Snyk names 4.4.1-prerelease.0 as the latest non-vulnerable version — a prerelease, which is not
something to pin a production dependency to. There is a community fork, `@protobi/exceljs`
(4.4.0-protobi.10, May 2026), described by its own authors as "a bridge fork with features pending
upstream merge" that should not be preferred over the official package. Both fail
`CLAUDE.md`'s two-year rule and its zero-vulnerabilities rule.

### SheetJS `xlsx` — rejected outright: the fixed versions are not on npm

Apache-2.0 licensed. The npm registry's latest version is **0.18.5**, and it carries both known
advisories:

- **CVE-2023-30533** — prototype pollution via a crafted file, fixed in 0.19.3.
- **CVE-2024-22363** — ReDoS, affecting all Community Edition versions through 0.20.1, fixed in
  0.20.2.

SheetJS stopped publishing to the public npm registry and distributes the fixed builds from
`cdn.sheetjs.com` instead (see SheetJS issues
[#2961](https://git.sheetjs.com/sheetjs/sheetjs/issues/2961) and
[#3316](https://git.sheetjs.com/sheetjs/sheetjs/issues/3316)). Installing a non-vulnerable version
therefore means pointing the package manager at a third-party CDN, which gives up registry
provenance and sits badly beside this project's existing "no runtime script from a third-party CDN"
rule. Taking 0.18.5 from npm instead means knowingly installing two published CVEs. Neither is
acceptable.

### `write-excel-file` — rejected on the streaming requirement

MIT licensed and genuinely maintained: 4.1.1, published June 2026, in use by 71 other npm packages.
It is the healthiest option of the three. It has no streaming writer — it builds the whole workbook
in memory before serialising — which is the one property issue #14 names explicitly, and it would
still add a dependency and its own zip dependency for a feature set of which this export uses a
fraction. (Its metadata here comes from the npm web listing; the registry was unreachable from the
build machine at the time of the check, so `npm view` could not confirm the unpacked size.)

### CSV instead — rejected by the ticket

Ruled out in the issue itself, and correctly: Indonesian decimal separators in a CSV make an
immediate support problem, and a CSV cannot carry a number format, a real date, a frozen header or
a column width at all.
