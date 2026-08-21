import { z } from "zod";

/**
 * `Category.code` per PRD FR-3.2: 2-4 uppercase letters (`LAB`, `IT`, `FUR`,
 * `OFC`, `OTH` at seed time), used verbatim inside the generated asset code
 * (FR-2.1). Lowercase and digits must be *rejected*, not normalised — the
 * acceptance criteria ask for a validation error, not a silent uppercase
 * transform.
 */
const CATEGORY_CODE_PATTERN = /^[A-Z]{2,4}$/;

export const categoryIdSchema = z.string().trim().min(1);

export const categorySchema = z.object({
  code: z.string().trim().regex(CATEGORY_CODE_PATTERN),
  name: z.string().trim().min(1),
  nameEn: z.string().trim().min(1),
});

export type CategoryFieldErrors = Partial<
  Record<"code" | "name" | "nameEn", string>
>;

/**
 * `createCategoryAction` and `updateCategoryAction`'s shared return shape.
 * Declared here rather than in `actions.ts`, because a `"use server"` file
 * may only export async functions (Next.js enforces this at build time).
 */
export interface CategoryFormState {
  readonly fieldErrors: CategoryFieldErrors;
  readonly formError: string | null;
  readonly isSuccess: boolean;
}

export const INITIAL_CATEGORY_FORM_STATE: CategoryFormState = {
  fieldErrors: {},
  formError: null,
  isSuccess: false,
};
