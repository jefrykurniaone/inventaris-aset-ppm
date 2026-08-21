"use server";

import { cookies } from "next/headers";

import {
  LOCALE_COOKIE_MAX_AGE_SECONDS,
  LOCALE_COOKIE_NAME,
  type Locale,
} from "./config";

/**
 * Server action invoked directly from the locale switcher (a Client
 * Component). Persists the choice in a cookie so it survives navigation and
 * a reload; Next.js re-renders the current route's Server Components with
 * the new locale after this action resolves, so no client-side reload or
 * router refresh call is needed.
 */
export async function setLocale(locale: Locale): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE_NAME, locale, {
    maxAge: LOCALE_COOKIE_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
  });
}
