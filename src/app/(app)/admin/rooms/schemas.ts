import { z } from "zod";

const CODE_MAX_LENGTH = 20;
const NAME_MAX_LENGTH = 120;

export const roomIdSchema = z.string().trim().min(1);

/** `buildingId` is required (PRD FR-3.3: "Rooms belong to a building"), not
 * merely encouraged by the form — an empty selection fails this schema the
 * same way a blank code or name does. */
export const roomSchema = z.object({
  buildingId: z.string().trim().min(1),
  code: z.string().trim().min(1).max(CODE_MAX_LENGTH),
  name: z.string().trim().min(1).max(NAME_MAX_LENGTH),
});

export type RoomFieldErrors = Partial<
  Record<"buildingId" | "code" | "name", string>
>;

export interface RoomFormState {
  readonly fieldErrors: RoomFieldErrors;
  readonly formError: string | null;
  readonly isSuccess: boolean;
}

export const INITIAL_ROOM_FORM_STATE: RoomFormState = {
  fieldErrors: {},
  formError: null,
  isSuccess: false,
};

/** The list page's `?buildingId=` filter (PRD FR-3.3: "the room list is
 * filterable by building"). Empty string means "all buildings". */
export const roomBuildingFilterSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => value || undefined);
