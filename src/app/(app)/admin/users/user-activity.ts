import { db } from "@/lib/db";

/**
 * The `UserActivity` writes and reads behind the admin users surface (issue
 * #86), kept apart from `actions.ts` for the same reason the master-data
 * folders keep a `mutations.ts`: nothing here touches `next/headers`, so each
 * function is a plain `async` function with no dependency on a Next.js request
 * context. The `requireAdmin()` authorisation boundary lives one layer up, in
 * `actions.ts`; nothing in this file is reachable from a browser on its own.
 *
 * Every row this writes is restricted data. It is read by the admin users
 * surface only — no public or non-admin query selects this table at all.
 */

/**
 * The `UserActivityType` members, spelled as a literal union rather than
 * imported from `@/generated/prisma`: `src/lib/db.ts` is the only module
 * allowed to import the generated client, and Prisma accepts a matching string
 * literal for an enum column. A member added to the schema without being added
 * here fails to type-check at the call site, which is the intended coupling.
 */
export type UserActivityKind = "deactivated" | "reactivated";

export interface UserActivityRecord {
  readonly userId: string;
  readonly actorId: string;
  readonly type: UserActivityKind;
  readonly reason: string;
}

/** Appends one row. The table is append-only: nothing amends or deletes. */
export async function recordUserActivity(
  activity: UserActivityRecord,
): Promise<void> {
  await db.userActivity.create({ data: { ...activity } });
}

/**
 * Reads the reason currently stored against a deactivated account, so a
 * reactivation can record what it is about to clear. Better Auth's
 * `unbanUser` sets `banReason` to null, so this has to run *before* it.
 *
 * Returns the empty string when nothing is stored — an account deactivated
 * before this feature existed has a null `banReason`, and `UserActivity.reason`
 * is `NOT NULL`. The empty string says "no reason was on file", which is
 * exactly what happened; inventing placeholder text would not be.
 */
export async function readDeactivationReason(userId: string): Promise<string> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { banReason: true },
  });
  return user?.banReason ?? "";
}
