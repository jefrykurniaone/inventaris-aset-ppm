# 0011 — The shadcn CLI leaves the dependency tree

- **Status**: Accepted
- **Date**: 2026-11-14
- **Deciders**: Jefry Kurniawan

## Context

On 2026-11-14 the repository had four open Dependabot alerts, all in development scope. Spec #206
lists them. Each one enters the lockfile through the `shadcn` devDependency, at 3.8.5:

| Alert | Package | Advisory | Path |
|---|---|---|---|
| #2 | `body-parser` 2.3.0 | GHSA-27r3-jxmh-p828, high | `shadcn → @modelcontextprotocol/sdk → express@5.2.1 → body-parser` |
| #3 | `zod` 3.25.76 | GHSA-mrhx-c7xc-m3w5, high | `shadcn → zod@3.25.76`, its own copy; the application uses `zod` 4 |
| #18 | `deepmerge` 4.3.1 | GHSA-gcqx-w48m-w2h4, low | `shadcn → deepmerge@4.3.1` |
| #23 | `minimatch` 10.2.6 | GHSA-g3hv-75wg-m249, medium | `shadcn → ts-morph → @ts-morph/common → minimatch`; a second path runs through `@typescript-eslint/typescript-estree` and is not this ADR's |

The `braces` chain of ADR 0004's 2026-10-23 amendment also ran through `shadcn`, by two of its three
paths. Its advisory was withdrawn on 2026-10-23.

None of the four reaches the application, and `npm audit --omit=dev` reports 0. They are still
noise that hides the next real alert, and under the whole-tree audit of spec #206 they would fail
every pull request.

`shadcn` is installed for one reason. The global stylesheet imports `shadcn/tailwind.css`, a 1.6 KB
MIT-licensed file with custom variants (`data-open`, `data-closed`, `data-checked` and others), the
accordion keyframes and a `no-scrollbar` utility. The CLI itself is used rarely, to scaffold a
component that is then edited by hand.

An override cannot fix this. `deepmerge` has no patched release, and `zod` 4 under a parent that
declares 3 would break the parent's range.

## Decision

**Hand eject from 3.8.5 into a separate file.** The stylesheet is copied from the installed 3.8.5
package, `node_modules/shadcn/dist/tailwind.css`, to `src/app/shadcn-tailwind.css`. Below a header
comment the content is byte-identical to the package file. The header names the source
(`shadcn@3.8.5`, `dist/tailwind.css`), carries the copyright line and the MIT permission notice
from the package's `LICENSE.md`, and says the content is not edited by hand: a change means
re-copying from a named version. `src/app/globals.css` imports the copy in the position where it
imported the package, after `tailwindcss` and `tw-animate-css` and before `@custom-variant dark`.
No other line of `globals.css` changes.

The copy is a separate file, not inlined into `globals.css`, for two reasons:

- `globals.css` is 185 lines, and the copy with its licence header is 122. Inlined, the file would
  pass the 300-line limit.
- `src/lib/globals-css-tokens.ts` parses `globals.css` for the contrast tests. Third-party `@theme`
  and `@keyframes` blocks would sit inside the text that parser reads, and nothing it needs is in
  them.

It is a hand eject because `npx shadcn@latest eject` would inline 4.x content, and that would
change the CSS. The build output was compared before and after: the concatenated
`.next/static/css/*.css` is byte-identical.

**The CLI runs through `npx`.** `components.json` stays, because the CLI reads it. The command is
`npx shadcn@<exact version> add <component>`, with the version written out. There is no npm script
and no `shadcn` entry in `package.json`. After `add`, check that neither `package.json` nor
`src/app/globals.css` has regained `shadcn` or the `shadcn/tailwind.css` import, and revert either
if it has. `CLAUDE.md` carries the rule.

**SonarQube Cloud.** There is no exclusion in advance. If the analysis flags
`src/app/shadcn-tailwind.css`, the file joins `sonar.exclusions` in `sonar-project.properties`
beside `public/vendor/**`, which is the same kind of file: a verbatim vendored copy. The finding is
never silenced with `NOSONAR`, and the vendored content is never edited to satisfy it.

SonarQube Cloud did flag it on the pull request for this ADR: 16 issues, all `css:S8776` ("Missing
scoping root"), on the `@keyframes` and variant blocks of the vendored content. So
`src/app/shadcn-tailwind.css` is in `sonar.exclusions`, with a comment beside the `public/vendor`
one.

## Consequences

- `shadcn` leaves the lockfile with its subtree, 237 package entries, and no package that stays
  changes version. Alerts #2, #3 and #18 close as fixed, and the ts-morph path of #23 is gone.
- The stylesheet no longer updates by itself. A change to `shadcn/tailwind.css` upstream reaches
  this repository only when someone re-copies it from a named version, on purpose, and updates the
  header.
- A new component from the CLI may depend on a variant or utility that a later `shadcn` release
  adds to its stylesheet. The vendored copy then lacks it, and the fix is to re-copy.
- The repository carries 95 lines of a third party's CSS plus a 27-line header, under its licence.
- ADR 0004's 2026-11-14 acceptance of `deepmerge` is resolved, and the ts-morph half of `minimatch`
  with it. The amendment to ADR 0004 records that.

## Alternatives considered

- **`npx shadcn@latest eject`.** It is the documented route, but it inlines 4.x content into
  `globals.css`. That changes the CSS, which this change must not do, and it puts the content in
  the file the contrast tests parse.
- **Inline the copy into `globals.css`.** It breaks the 300-line limit and puts third-party blocks
  inside the text `globals-css-tokens.ts` reads. A separate file avoids both.
- **Keep the package and accept the alerts.** That was ADR 0004's 2026-11-14 amendment. This ADR
  reverses it: the owner decided to close every alert and to keep the whole tree clean.
- **An override.** It is impossible for `deepmerge`, because no patched version exists. For `zod`
  and `minimatch` it would break the parents' declared ranges, as ADR 0004 already explains for
  `minimatch`.
