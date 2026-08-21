import { z } from "zod";

const NAME_MAX_LENGTH = 150;
const NOTES_MAX_LENGTH = 500;

export const fundingSourceIdSchema = z.string().trim().min(1);

/** `notes` is optional free text; an empty submission is normalised to
 * `null` rather than stored as an empty string, so "no notes" has one
 * representation. */
export const fundingSourceSchema = z.object({
  name: z.string().trim().min(1).max(NAME_MAX_LENGTH),
  notes: z
    .string()
    .trim()
    .max(NOTES_MAX_LENGTH)
    .optional()
    .transform((value) => value || null),
});

export type FundingSourceFieldErrors = Partial<
  Record<"name" | "notes", string>
>;

export interface FundingSourceFormState {
  readonly fieldErrors: FundingSourceFieldErrors;
  readonly formError: string | null;
  readonly isSuccess: boolean;
}

export const INITIAL_FUNDING_SOURCE_FORM_STATE: FundingSourceFormState = {
  fieldErrors: {},
  formError: null,
  isSuccess: false,
};
