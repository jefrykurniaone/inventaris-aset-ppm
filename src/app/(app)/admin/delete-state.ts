/**
 * Shared return shape for every master-data delete action (PRD FR-3.4):
 * `Category`, `Building`, `Room`, and `FundingSource` all delete through
 * this same state, driven by `src/components/DeleteControl.tsx`.
 *
 * Deliberately a plain `.ts` module with no JSX, imported by every
 * `actions.ts` in this directory tree: those files are only ever imported
 * (directly or through a mocked chain) by Vitest, and this project's
 * `tsconfig.json` sets `jsx: "preserve"` for Next.js's own build — which
 * breaks Vite's plain-JS import analysis if a `.test.ts` file's import
 * chain ever reaches a `.tsx` file. Keeping this type out of
 * `DeleteControl.tsx` itself means an actions file can depend on it without
 * ever pulling JSX into the test run.
 */
export interface DeleteState {
  readonly formError: string | null;
}

export const INITIAL_DELETE_STATE: DeleteState = { formError: null };
