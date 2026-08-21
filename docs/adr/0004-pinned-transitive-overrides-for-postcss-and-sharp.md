# 0004 — Pinned transitive overrides for `postcss`, `sharp`, and `deepmerge-ts`

- **Status**: Accepted
- **Date**: 2026-08-21; amended 2026-08-21 for `deepmerge-ts` (issue #30)
- **Deciders**: Jefry Kurniawan

## Context

`next@15.5.23` brings two transitive packages that carry open high-severity advisories, and it
does not let npm resolve past them on its own:

- `postcss` is a **hard pin** in Next's `dependencies` (`"postcss": "8.4.31"`), not a range, so
  no amount of hoisting picks up a newer patch.
- `sharp` is an optional dependency declared as `^0.34.3`.

With no `overrides` block, `npm audit` reports 3 high-severity vulnerabilities:

| Package | Advisory |
|---|---|
| `postcss <= 8.5.22` | [GHSA-qx2v-qp2m-jg93](https://github.com/advisories/GHSA-qx2v-qp2m-jg93) — XSS via an unescaped `</style>` in stringify output |
| `postcss <= 8.5.22` | [GHSA-6g55-p6wh-862q](https://github.com/advisories/GHSA-6g55-p6wh-862q), [GHSA-fxqj-rqcc-2cmp](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp), [GHSA-r28c-9q8g-f849](https://github.com/advisories/GHSA-r28c-9q8g-f849) — attacker-controlled `sourceMappingURL` reads arbitrary `.map` files (path traversal) |
| `sharp < 0.35.0` | [GHSA-f88m-g3jw-g9cj](https://github.com/advisories/GHSA-f88m-g3jw-g9cj) — inherited libvips CVE-2026-33327, CVE-2026-33328, CVE-2026-35590, CVE-2026-35591 |

`npm audit fix --force` resolves all three by installing `next@16.3.1` — a major-version upgrade,
which is a decision of its own and not one this scaffolding pull request gets to make. PRD §7.6
forbids shipping a package with a known unpatched CVE, so doing nothing was not an option either.

## Decision

Pin both packages through npm `overrides` in `package.json`:

```json
"overrides": {
  "postcss": "^8.5.26",
  "sharp": "^0.35.3"
}
```

With the block in place, `npm audit` reports **0 vulnerabilities**.

**Remove each entry when Next itself depends on a patched version** — that is, when `next`
depends on `postcss >= 8.5.26` and on `sharp >= 0.35.3`. The check is mechanical: delete the
entry, run `npm install --package-lock-only`, then `npm audit`. If it still reports zero, the
override is dead weight and should go. Do not delete the block casually during a dependency
bump; that is exactly how an unexplained override gets lost and an advisory quietly returns.

## Consequences

- `postcss@^8.5.26` is a straightforward forward pin within the same major. Next's pin is exact
  rather than ranged for reproducibility, not for compatibility, and `@tailwindcss/postcss`,
  `shadcn`, and `vite` all already resolve to `8.5.26`, so the whole tree dedupes onto one copy.
- `sharp@^0.35.3` is **outside** Next's declared `^0.34.3` optional range. This is a deliberate
  range violation: it buys the libvips CVE fixes at the cost of running Next's image optimiser
  against a `sharp` major Next has not tested. `sharp` is optional, so a mismatch degrades image
  optimisation rather than breaking the build.
- The `sharp` override is currently **untested by anything**. `next build` does not exercise
  `sharp` at all, because nothing in the app uses `next/image` yet — the build output is five
  static routes and no optimised image. The photo pipeline ticket (**#9**) is its first real
  test. If `next/image` misbehaves there, suspect this override before suspecting the pipeline
  code, and consider `next@16` instead of loosening the pin back to a vulnerable range.

## Alternatives considered

- **Upgrade to `next@16.3.1`**, as `npm audit fix --force` proposes. Rejected for now: a major
  framework upgrade is not in scope for a scaffolding pull request, and it needs its own ADR.
- **Do nothing and accept the advisories.** Rejected: PRD §7.6 forbids a package with a known
  unpatched CVE, and CI would carry three high-severity findings from day one.
- **Fork or vendor `postcss`.** Rejected as disproportionate; an override achieves the same with
  one line and no maintenance surface.

## Amendment — `deepmerge-ts`, reached through the Prisma CLI (issue #30)

### Context

Installing Prisma 7 added a third advisory, on the same shape of path:

- [GHSA-ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx) — `deepmerge-ts < 8.0.0`,
  stack exhaustion on recursive object graphs (CWE-674), high severity.
- Path: `prisma@7.9.1 → @prisma/config@7.9.1 → deepmerge-ts@7.1.5`.
- `@prisma/config` declares `deepmerge-ts` at **exactly** `7.1.5`, so npm cannot resolve past it.
- `npm audit fix --force` proposes `prisma@6.12.0` — abandoning Prisma 7, which ADR 0001 selects and
  `CLAUDE.md` forbids substituting. That option was closed from the start.

It was accepted rather than fixed inside the wave 0 spike (#2) because it is not attacker-reachable
here: `@prisma/config` is what loads `prisma.config.ts` for `prisma generate` and `prisma migrate`,
it is not in the runtime bundle, no user input reaches it, and triggering the advisory needs a
self-referencing config object this repository does not have. But three high findings on every
`npm audit` is the kind of noise that hides something real later.

### Decision

Add the override, and it works:

```json
"overrides": {
  "deepmerge-ts": "^8.0.1",
  "postcss": "^8.5.26",
  "sharp": "^0.35.3"
}
```

`deepmerge-ts` resolves to **8.0.2**, and `npm audit` reports **0 vulnerabilities at every severity**
— down from 3 high.

This is an override across a **major version** on the loader that reads `prisma.config.ts`, so the
risk was that the Prisma CLI would silently stop reading its own configuration. It does not. Proven,
rather than assumed:

| Check | Result |
|---|---|
| `npx prisma validate` | `Prisma schema loaded from prisma` / `The schemas at prisma are valid` |
| `npx prisma generate` | `Generated Prisma Client (7.9.1) to .\src\generated\prisma` |
| `npx prisma migrate status` | `4 migrations found` / `Database schema is up to date!` |
| `npx prisma migrate dev --create-only` | created a migration directory, then discarded |
| `npm run auth:generate` | `Your schema is already up to date.` |
| `npm run build` | `✓ Compiled successfully` |

The first line is the load-bearing evidence, and it is worth spelling out why. **`schema: "prisma"`
— a directory rather than a file — exists only in `prisma.config.ts`.** It is not a Prisma default
and cannot be inferred. So `Prisma schema loaded from prisma` is direct proof that `@prisma/config`
parsed the config file successfully under `deepmerge-ts@8`. Had the loader broken, the CLI would
have fallen back to looking for a schema Prisma's defaults name, and found nothing.

### Removal condition

Delete the entry when `@prisma/config` itself depends on `deepmerge-ts >= 8.0.0`. Same mechanical
check as the other two: remove the line, `npm install --package-lock-only`, `npm audit`. If it still
reports zero, the override is dead weight.

### Enforcement

`npm audit --audit-level=high --omit=dev` now runs in CI, so this outcome is enforced rather than
recorded. `--omit=dev` scopes the gate to what actually ships, which is consistent with the
reachability argument above rather than in tension with it: a CLI-only advisory should not fail a
pull request that did not cause it, while anything reaching a user should.

Worth knowing for whoever revisits this: with all three overrides in place the tree is currently
clean **even without** `--omit=dev`. The flag is about which future advisory is allowed to break the
build, not about hiding a finding that exists today.
