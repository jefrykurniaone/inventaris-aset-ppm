/**
 * Duck-types a Prisma `PrismaClientKnownRequestError`'s `{ code }` shape
 * rather than importing `Prisma.PrismaClientKnownRequestError` from
 * `@/generated/prisma`: `src/lib/db.ts` is the only module allowed to import
 * the generated client, so anything else that wants to recognise a Prisma
 * error reads the shape it throws instead. Mirrors the duck-typing
 * `src/app/(app)/admin/users/actions.ts` already uses for a Better Auth
 * `APIError`, and `scripts/verify-application-schema.ts` for the same
 * Prisma errors.
 *
 * https://www.prisma.io/docs/orm/reference/error-reference — `P2002` is a
 * unique constraint violation, `P2003` a foreign key constraint violation.
 */
const UNIQUE_CONSTRAINT_CODE = "P2002";
const FOREIGN_KEY_CONSTRAINT_CODE = "P2003";

function readPrismaErrorCode(error: unknown): string | undefined {
  if (error === null || typeof error !== "object" || !("code" in error)) {
    return undefined;
  }
  const { code } = error as { code?: unknown };
  return typeof code === "string" ? code : undefined;
}

/**
 * True when `error` is a unique-constraint violation (`P2002`) — a
 * duplicate `Category.code`, `Building.code`, or `FundingSource.name`.
 */
export function isUniqueConstraintError(error: unknown): boolean {
  return readPrismaErrorCode(error) === UNIQUE_CONSTRAINT_CODE;
}

/**
 * True when `error` is a foreign-key-constraint violation (`P2003`) — the
 * `onDelete: Restrict` relations from `Asset`/`Room` into the master-data
 * tables (PRD FR-3.4). Master-data delete actions attempt the delete
 * directly and check this on failure, rather than counting references and
 * deleting as two separate steps: a row referenced in between the count and
 * the delete would otherwise surface this as an unhandled `P2003` instead of
 * a localised message.
 */
export function isForeignKeyConstraintError(error: unknown): boolean {
  return readPrismaErrorCode(error) === FOREIGN_KEY_CONSTRAINT_CODE;
}
