/**
 * Route path constants shared between server-only modules
 * (`src/lib/require-user.ts`, Server Component pages) and plain Client
 * Components (`src/components/SignOutButton.tsx`). This file imports
 * nothing — in particular nothing from `next/headers` or `@/lib/auth` — so a
 * Client Component can import it without pulling a server-only module into
 * the browser bundle, which is exactly what would happen if it imported
 * these constants from `require-user.ts` instead.
 */
export const SIGN_IN_PATH = "/sign-in";
export const NOT_AUTHORIZED_PATH = "/not-authorized";
export const HOME_PATH = "/";
export const ASSETS_PATH = "/assets";
export const NEW_ASSET_PATH = "/assets/new";
export const ASSETS_EXPORT_PATH = "/assets/export";
export const LOANS_PATH = "/loans";
export const ADMIN_USERS_PATH = "/admin/users";
export const ADMIN_CATEGORIES_PATH = "/admin/categories";
export const ADMIN_BUILDINGS_PATH = "/admin/buildings";
export const ADMIN_ROOMS_PATH = "/admin/rooms";
export const ADMIN_FUNDING_SOURCES_PATH = "/admin/funding-sources";
