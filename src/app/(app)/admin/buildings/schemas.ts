import { z } from "zod";

/** Generous enough for a building code/name without inviting a
 * free-text essay into a field that appears in room and asset pickers. */
const CODE_MAX_LENGTH = 20;
const NAME_MAX_LENGTH = 120;

export const buildingIdSchema = z.string().trim().min(1);

export const buildingSchema = z.object({
  code: z.string().trim().min(1).max(CODE_MAX_LENGTH),
  name: z.string().trim().min(1).max(NAME_MAX_LENGTH),
});

export type BuildingFieldErrors = Partial<Record<"code" | "name", string>>;

export interface BuildingFormState {
  readonly fieldErrors: BuildingFieldErrors;
  readonly formError: string | null;
  readonly isSuccess: boolean;
}

export const INITIAL_BUILDING_FORM_STATE: BuildingFormState = {
  fieldErrors: {},
  formError: null,
  isSuccess: false,
};
