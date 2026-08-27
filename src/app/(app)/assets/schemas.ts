import { z } from "zod";

/**
 * The asset register's shared validation (PRD FR-2.4 and the field table in
 * §8.2). One schema, imported by the server action that is authoritative and
 * available to the client bundle unchanged — this module imports nothing from
 * `next/headers`, `@/lib/db` or `@/lib/auth`, so it carries no server-only
 * dependency into the browser.
 *
 * A "use server" file may only export async functions, which is why the
 * schemas, the field-name list and the form-state type live here rather than
 * in `actions.ts`.
 */

const SHORT_TEXT_MAX_LENGTH = 200;
const NOTES_MAX_LENGTH = 2000;

/** PRD FR-3.5's fixed enumerations, spelled exactly as the Prisma enum
 * members in `prisma/models/enums.prisma` — which are already the database
 * values, so these string literals are what the client accepts. */
export const ASSET_STATUSES = [
  "active",
  "in_repair",
  "loaned",
  "retired",
  "lost",
] as const;

export const ASSET_CONDITIONS = ["good", "fair", "poor"] as const;

export type AssetStatus = (typeof ASSET_STATUSES)[number];
export type AssetCondition = (typeof ASSET_CONDITIONS)[number];

/** The one status the loan register owns (PRD FR-6, issue #15). */
export const LOANED_STATUS: AssetStatus = "loaned";

/**
 * Why a submitted status is refused, or `null` when it is allowed. `current`
 * is `null` for a create.
 *
 * The asset form does not own `loaned`, in *either* direction, and these two
 * refusals are one rule seen from its two sides. `loaned` is a fact about a
 * `Loan` row, not a label somebody types: setting it here would record an
 * asset as checked out with nobody holding it and no due date, and clearing
 * it here would strand the open loan row that is holding the real one. Both
 * transitions belong to check-out and return (#15).
 *
 * Refusing only the way *out* — which is all FR-2's wording strictly asks for
 * — leaves a one-way door: the form offers `loaned`, and the moment it is
 * saved the same rule locks the asset out of every other status until #15
 * ships. The picker hides `loaned` for exactly this reason, and this function
 * is why hiding it is a courtesy rather than the enforcement.
 */
export type StatusTransitionRefusal =
  "STATUS_LOCKED_BY_LOAN" | "STATUS_SET_BY_LOAN";

export function refuseStatusTransition(
  current: string | null,
  next: AssetStatus,
): StatusTransitionRefusal | null {
  const isCurrentlyLoaned = current === LOANED_STATUS;
  const isBecomingLoaned = next === LOANED_STATUS;

  if (isCurrentlyLoaned && !isBecomingLoaned) {
    return "STATUS_LOCKED_BY_LOAN";
  }
  if (!isCurrentlyLoaned && isBecomingLoaned) {
    return "STATUS_SET_BY_LOAN";
  }
  return null;
}

/**
 * The statuses the form's picker may offer. An asset already out on loan gets
 * exactly one — its own — and the control is rendered locked; every other
 * asset gets every status except `loaned`. Mirrors `refuseStatusTransition`
 * above, which is what actually enforces it.
 */
export function selectableStatuses(current: string): readonly AssetStatus[] {
  if (current === LOANED_STATUS) {
    return [LOANED_STATUS];
  }
  return ASSET_STATUSES.filter((status) => status !== LOANED_STATUS);
}

/**
 * The register predates the directorate's digital records but not by much;
 * anything earlier is a typo rather than an acquisition. One year ahead is
 * allowed because procurement is routinely booked against the coming budget
 * year, and the bound is read at validation time rather than at module load
 * so a server that stays up over New Year does not start rejecting the
 * current year.
 */
const MIN_ACQUISITION_YEAR = 1970;
const ACQUISITION_YEAR_LOOKAHEAD = 1;

function isPlausibleAcquisitionYear(year: number): boolean {
  return year <= new Date().getFullYear() + ACQUISITION_YEAR_LOOKAHEAD;
}

/** `Decimal(14, 2)`: at most twelve integer digits and two decimals, with no
 * leading zeros, so one price has exactly one accepted spelling. Anchored and
 * fully bounded — no ambiguous repetition to backtrack on (S5852, S8786). */
const PURCHASE_PRICE_PATTERN = /^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/;

export const PRICE_DECIMAL_PLACES = 2;

/** Canonicalises `1500` and `1500.5` to `1500.00` and `1500.50`, by padding
 * the string rather than by going through a float: the diff written into the
 * activity log compares this against `Decimal.toFixed(2)` read back from
 * Postgres, and two spellings of one price would otherwise read as an edit. */
function toCanonicalPrice(value: string): string {
  const [whole, fraction = ""] = value.split(".");
  return `${whole}.${fraction.padEnd(PRICE_DECIMAL_PLACES, "0")}`;
}

/** `<input type="date">` submits `YYYY-MM-DD`. Parsed at UTC midnight so the
 * stored instant does not shift with the server's zone. */
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function toUtcMidnight(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

/**
 * A `NaN` check alone is not enough: V8 silently rolls `2027-02-30` forward
 * to 2 March rather than rejecting it, so a typed-in day that does not exist
 * would be stored as a different, plausible-looking date. Round-tripping the
 * parsed instant back to `YYYY-MM-DD` catches the rollover.
 */
function isRealCalendarDate(value: string): boolean {
  const parsed = toUtcMidnight(value);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }
  return parsed.toISOString().startsWith(value);
}

export const assetIdSchema = z.string().trim().min(1);

const requiredIdSchema = z.string().trim().min(1);

const optionalShortText = z
  .string()
  .trim()
  .max(SHORT_TEXT_MAX_LENGTH)
  .optional()
  .transform((value) => value ?? null);

export const assetSchema = z.object({
  name: z.string().trim().min(1).max(SHORT_TEXT_MAX_LENGTH),
  categoryId: requiredIdSchema,
  roomId: requiredIdSchema,
  condition: z.enum(ASSET_CONDITIONS),
  status: z.enum(ASSET_STATUSES),
  acquisitionYear: z.coerce
    .number()
    .int()
    .min(MIN_ACQUISITION_YEAR)
    .refine(isPlausibleAcquisitionYear),
  brand: optionalShortText,
  model: optionalShortText,
  serialNumber: optionalShortText,
  universityAssetCode: optionalShortText,
  notes: z
    .string()
    .trim()
    .max(NOTES_MAX_LENGTH)
    .optional()
    .transform((value) => value ?? null),
  purchasePrice: z
    .string()
    .trim()
    .regex(PURCHASE_PRICE_PATTERN)
    .optional()
    .transform((value) =>
      value === undefined ? null : toCanonicalPrice(value),
    ),
  fundingSourceId: requiredIdSchema
    .optional()
    .transform((value) => value ?? null),
  procurementDocNo: optionalShortText,
  vendor: optionalShortText,
  warrantyUntil: z
    .string()
    .trim()
    .regex(ISO_DATE_PATTERN)
    .refine(isRealCalendarDate)
    .optional()
    .transform((value) => (value === undefined ? null : toUtcMidnight(value))),
  custodianName: optionalShortText,
  custodianEmail: z
    .email()
    .max(SHORT_TEXT_MAX_LENGTH)
    .optional()
    .transform((value) => value ?? null),
});

export type AssetInput = z.infer<typeof assetSchema>;

/** Every writable field, in the order the form presents them. Used to read
 * the submission out of `FormData`, to map issue paths onto localised field
 * errors, and to diff a submission against the stored row. */
export const ASSET_FIELD_NAMES = [
  "name",
  "categoryId",
  "roomId",
  "condition",
  "status",
  "acquisitionYear",
  "brand",
  "model",
  "serialNumber",
  "universityAssetCode",
  "notes",
  "purchasePrice",
  "fundingSourceId",
  "procurementDocNo",
  "vendor",
  "warrantyUntil",
  "custodianName",
  "custodianEmail",
] as const;

export type AssetFieldName = (typeof ASSET_FIELD_NAMES)[number];

/** The fields whose only accepted submission is a non-empty value; every
 * other field in `ASSET_FIELD_NAMES` reads an empty input as "not given". */
export const REQUIRED_ASSET_FIELD_NAMES: readonly AssetFieldName[] = [
  "name",
  "categoryId",
  "roomId",
  "condition",
  "status",
  "acquisitionYear",
];

export type AssetFieldErrors = Partial<Record<AssetFieldName, string>>;

/** A note rendered under a field whose control is locked, keyed by field —
 * currently only `status`, on an asset that is out on loan. Present means
 * locked, so there is no second flag to keep in step with the message. */
export type AssetFieldNotes = Partial<Record<AssetFieldName, string>>;

/** Every field as the string its `<input>` wants. The edit page fills this
 * from the stored row (`queries.ts`); the create page uses the blank below.
 * Declared here, not in `queries.ts`, so the client form can import it
 * without dragging `@/lib/db` into the browser bundle. */
export type AssetFormDefaults = Record<AssetFieldName, string>;

/** `status` starts at `active` to match `Asset.status @default(active)`;
 * `condition` starts blank because there is no safe guess about the state of
 * an item nobody has looked at yet. */
export const EMPTY_ASSET_FORM_DEFAULTS: AssetFormDefaults = {
  name: "",
  categoryId: "",
  roomId: "",
  condition: "",
  status: "active",
  acquisitionYear: "",
  brand: "",
  model: "",
  serialNumber: "",
  universityAssetCode: "",
  notes: "",
  purchasePrice: "",
  fundingSourceId: "",
  procurementDocNo: "",
  vendor: "",
  warrantyUntil: "",
  custodianName: "",
  custodianEmail: "",
};

/** One entry of a picker backed by master data (PRD FR-3.1). Structurally the
 * `ComboboxOption` the searchable pickers take (issue #88), so the same array
 * feeds a native `<select>` and a combobox without conversion. */
export interface AssetOption {
  readonly id: string;
  readonly label: string;
  /** The heading a searchable picker lists this option under — set on rooms,
   * which group by building, and absent everywhere else. A native `<select>`
   * ignores it. */
  readonly group?: string;
}

export interface AssetFormOptions {
  readonly categories: readonly AssetOption[];
  readonly rooms: readonly AssetOption[];
  readonly fundingSources: readonly AssetOption[];
}

export interface AssetFormState {
  readonly fieldErrors: AssetFieldErrors;
  readonly formError: string | null;
  readonly isSuccess: boolean;
  /**
   * The id of the row `createAssetAction` has just written, and `undefined`
   * on every other outcome — a rejected submission, and every update.
   *
   * It exists because the create flow no longer ends at the server (issue
   * #85). The first photo is attached by the browser after the row exists,
   * since the object path is keyed by the asset id, so the action hands the
   * id back and the client decides what happens next.
   */
  readonly createdAssetId?: string;
}

export const INITIAL_ASSET_FORM_STATE: AssetFormState = {
  fieldErrors: {},
  formError: null,
  isSuccess: false,
};
