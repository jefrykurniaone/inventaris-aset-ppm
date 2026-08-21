# Message catalogues

`id.json` (Indonesian, the default locale — PRD FR-10.1) and `en.json` (English) are the two
complete message catalogues consumed by `src/i18n/request.ts`. Both files are read at request
time; there is no build step that merges them.

## Convention

- **Keys are written in English**, regardless of which catalogue they live in. `id.json` and
  `en.json` share the exact same key set — only the values differ. Never name a key in
  Indonesian.
- **Namespaced by feature.** Each top-level key is a `PascalCase` namespace — typically a
  component or page name (`HomePage`, `LocaleSwitcher`, `RootLayout`). A namespace maps to
  `useTranslations("Namespace")` / `getTranslations("Namespace")` at the call site.
- **Both catalogues are completed in the same pull request that adds a key.** A key present in
  one file and missing from the other fails CI: `src/i18n/messages.test.ts` compares the two key
  sets in both directions and names whatever is missing.
- **Top-level namespaces are kept in alphabetical order**, and keys within a namespace are kept
  in alphabetical order too. This is what keeps a later ticket's change to its own namespace a
  pure append inside that namespace's block: two pull requests touching two different namespaces
  never touch the same lines, so merging one after the other is conflict-free. A pull request
  that touches an existing namespace should only add or edit keys inside it — do not reorder or
  reformat a neighbouring namespace's keys as a side effect.
- Adding a **new** namespace means inserting one new top-level block in its alphabetical slot in
  both files. That is the one case that can still collide with a concurrent pull request adding a
  different new namespace; resolve it by keeping both blocks, in alphabetical order.

## Adding a key

1. Add the key to the correct namespace in **both** `id.json` and `en.json`, in the same pull
   request.
2. Keep the namespace and the key alphabetically placed.
3. Run `npm run test` — `src/i18n/messages.test.ts` fails the build if the two files disagree.
