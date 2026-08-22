import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { FlatCompat } from "@eslint/eslintrc";
import prettierConfig from "eslint-config-prettier";
import jsxA11y from "eslint-plugin-jsx-a11y";

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
});

const LINTED_FILES = ["**/*.{js,mjs,cjs,jsx,ts,tsx}"];

const eslintConfig = [
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      // Sub-agent git worktrees live here while a ticket is in flight, each
      // with its own `node_modules` and `.next`. The patterns above anchor to
      // the repository root, so without this ESLint walks into a neighbouring
      // worktree's build output and reports thousands of findings against
      // compiled webpack chunks.
      ".claude/**",
      "out/**",
      "build/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      "src/generated/**",
      // A verbatim copy of the published `browser-image-compression` dist
      // build, self-hosted because loading the worker from a CDN is
      // prohibited. It is third-party bundled output, not this project's
      // source, and it must stay byte-identical to the installed package.
      "public/vendor/**",
      "next-env.d.ts",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    files: LINTED_FILES,
    rules: jsxA11y.flatConfigs.recommended.rules,
  },
  // Must stay last: turns off the stylistic rules Prettier owns.
  prettierConfig,
];

export default eslintConfig;
