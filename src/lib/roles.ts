import { z } from "zod";

/**
 * The product's two roles (PRD FR-1.2), layered on top of the Better Auth
 * `admin()` plugin's own role model rather than a hand-rolled one.
 *
 * `src/lib/auth.ts` configures the plugin with an explicit access-control
 * map keyed by these two constants: `ADMIN_ROLE` gets every default admin
 * permission (create, list, set-role, ban, set-password, set-email, get,
 * update on `user`; list, revoke, delete on `session`) and `STAFF_ROLE` gets
 * none. `hasPermission` — the check every admin-only endpoint runs — looks a
 * caller's role up in that map, so a staff caller is refused by the library
 * itself, independently of the application-level checks in
 * `src/lib/require-user.ts`. See the comment in `src/lib/auth.ts` for why an
 * explicit map is configured at all rather than leaving the plugin's
 * built-in `admin`/`user` defaults in place.
 */
export const ADMIN_ROLE = "admin";
export const STAFF_ROLE = "staff";

export const roles = [ADMIN_ROLE, STAFF_ROLE] as const;

export type Role = (typeof roles)[number];

/**
 * Server-side validation for any input that names a role — the admin
 * "create user" form in particular. Per the project standard, a server
 * action is an HTTP entry point and validates with a schema built from this
 * same array rather than trusting a TypeScript parameter type, which is
 * erased by the time a request reaches the action.
 */
export const roleSchema = z.enum(roles);
