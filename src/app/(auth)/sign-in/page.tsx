import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { HOME_PATH } from "@/lib/paths";
import { getSessionUser } from "@/lib/require-user";

import { SignInForm } from "./SignInForm";

/**
 * The sign-in page (PRD FR-1.1, FR-1.5) — one of the three routes reachable
 * without a session, alongside the public scan page and the auth API route.
 *
 * `POST /api/auth/sign-in/email` returns 403 with an empty body when the
 * request already carries a valid session cookie (confirmed at runtime
 * against `better-auth@1.7.1`), so an already-authenticated visitor must
 * never be allowed to post the form — they would see a bare, unexplained
 * failure. Checking the session here and redirecting away, before the form
 * ever renders, is what avoids that: this is a plain session read via
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
