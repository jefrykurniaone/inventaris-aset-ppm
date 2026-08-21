/**
 * Pre-commit gate. ESLint runs without `--fix` on purpose: a lint error must
 * block the commit rather than be silently repaired. `tsc` is whole-project
 * because TypeScript cannot type-check a file in isolation.
 *
 * @type {import("lint-staged").Configuration}
 */
const config = {
  "*.{ts,tsx}": [
    "eslint --max-warnings=0 --no-warn-ignored",
    "prettier --write",
    () => "tsc --noEmit",
  ],
  "*.{js,mjs,cjs,json,css,yml,yaml}": ["prettier --write"],
};

export default config;
