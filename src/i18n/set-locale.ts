"use server";

import { cookies } from "next/headers";

import {
  LOCALE_COOKIE_MAX_AGE_SECONDS,
  LOCALE_COOKIE_NAME,
  localeSchema,
} from "./config";

/**
 * Server action invoked directly from the locale switcher (a Client
 * Component). Persists the choice in a cookie so it survives navigation and
 * a reload; Next.js re-renders the current route's Server Components with
 * the new locale after this action resolves, so no client-side reload or
 * router refresh call is needed.
 *
 * `candidate` is untrusted input — a server action is an HTTP entry point,
 * reachable with any string regardless of what the calling component's
 * TypeScript types claim. `localeSchema.parse` is the server-side
 * validation this project requires at every such entry point; a value
 * outside `locales` throws before anything reaches `cookieStore.set`, and
 * Next.js reports that failure to the client as an opaque digest, never
 * the raw error text.
 */
export async function setLocale(candidate: string): Promise<void> {
  const locale = localeSchema.parse(candidate);
  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE_NAME, locale, {
    maxAge: LOCALE_COOKIE_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
  });
}
