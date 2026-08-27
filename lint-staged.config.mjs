/**
 * Pre-commit gate. ESLint runs without `--fix` on purpose: a lint error must
 * block the commit rather than be silently repaired. `tsc` is whole-project
 * because TypeScript cannot type-check a file in isolation.
 *
 * @type {import("lint-staged").Configuration}
 */
const config = {
  // Every staged file, not a file-type list. The encoding damage this catches
  // lands in prose, so the four files it has already destroyed were three
  // `.md` documents and one TypeScript comment — and no pattern below matches
  // `.md` at all. `*` also means a newly introduced file type is covered on
  // the day it appears rather than whenever someone remembers to add it.
  //
  // A repository-wide `core.hooksPath` cannot help here: husky sets that key
  // locally, and a local value overrides the global one, so a machine-wide
  // git hook is bypassed in this repository by design. This entry is how the
  // check reaches it. CI runs the same script over every tracked file.
  "*": ["tsx scripts/check-encoding.ts"],
  "*.{ts,tsx}": [
    "eslint --max-warnings=0 --no-warn-ignored",
    "prettier --write",
    () => "tsc --noEmit",
  ],
  "*.{js,mjs,cjs,json,css,yml,yaml}": ["prettier --write"],
};

export default config;
