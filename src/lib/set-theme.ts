"use server";

import { cookies } from "next/headers";

import {
  THEME_COOKIE_MAX_AGE_SECONDS,
  THEME_COOKIE_NAME,
  themeSchema,
} from "./theme";

/**
 * Server action invoked directly from the theme toggle (a Client Component
 * in the application shell). Persists the choice in a cookie so the root
 * layout can apply the `dark` class server-side on the next render — see
 * `src/i18n/set-locale.ts`, which this mirrors for the same reason: no
 * client-side reload or router refresh call is needed, because Next.js
 * re-renders Server Components with the new cookie value once this action
 * resolves.
 *
 * `candidate` is untrusted input — a server action is an HTTP entry point,
 * reachable with any string regardless of what the calling component's
 * TypeScript types claim. `themeSchema.parse` throws before anything reaches
 * `cookieStore.set` for a value outside `themes`; Next.js reports that
 * failure to the client as an opaque digest, never the raw error text.
 */
export async function setTheme(candidate: string): Promise<void> {
  const theme = themeSchema.parse(candidate);
  const cookieStore = await cookies();
  cookieStore.set(THEME_COOKIE_NAME, theme, {
    maxAge: THEME_COOKIE_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
  });
}
