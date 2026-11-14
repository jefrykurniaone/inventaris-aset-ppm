import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { HOME_PATH } from "@/lib/paths";
import { getSessionUser } from "@/lib/require-user";

import { SignInForm } from "./SignInForm";

/**
 * The sign-in page (PRD FR-1.1, FR-1.5) — one of the three routes reachable
 * without a session, alongside the public scan page and the auth API route.
 *
 * On the installed better-auth (1.7.23, checked at runtime on 2026-11-14), a
 * second `POST /api/auth/sign-in/email` from an already-authenticated browser
 * succeeds with 200 and creates an additional session. Earlier versions
 * answered 403 with an empty body. The page therefore redirects an
 * authenticated visitor home before the form renders: showing the form would
 * at best mint a pointless second session, and on older versions would fail
 * with a bare, unexplained 403. This is a plain session read via
 * `getSessionUser`, not `requireUser`, because the desired behaviour for "no
 * session" on this page is exactly the opposite of `requireUser`'s — render
 * the form, don't redirect.
 */
export default async function SignInPage() {
  const user = await getSessionUser();
  if (user) {
    redirect(HOME_PATH);
  }

  const t = await getTranslations("SignInPage");

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 p-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t("description")}</p>
      </header>
      <SignInForm />
    </main>
  );
}
