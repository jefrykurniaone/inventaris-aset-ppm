"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { SIGN_IN_PATH } from "@/lib/paths";

interface SignOutButtonProps {
  readonly label: string;
  readonly pendingLabel: string;
}

/**
 * Sign-out, available from the application shell on every authenticated
 * route. `authClient.signOut` clears the session cookie; the redirect to
 * the sign-in page happens from its `onSuccess` callback rather than being
 * assumed, so a failed sign-out (a dropped connection, say) leaves the
 * button re-enabled instead of navigating away from a session that is
 * still live. The callback also calls `router.refresh()` right after
 * `router.push`, so the Router Cache does not keep serving the signed-out
 * account's rendered layout and pages to a later sign-in or to
 * back-navigation.
 */
export function SignOutButton({
  label,
  pendingLabel,
}: Readonly<SignOutButtonProps>) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  async function handleSignOut() {
    setIsPending(true);
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push(SIGN_IN_PATH);
          // Queued behind the push above (see SignInForm's matching call)
          // so it runs after navigation lands on the sign-in page,
          // re-fetching it from the server and evicting the Router Cache
          // entries for the routes just signed out of — so back-navigation
          // can't restore an authenticated view from client cache.
          router.refresh();
        },
      },
    });
    setIsPending(false);
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleSignOut}
      disabled={isPending}
      aria-busy={isPending}
    >
      {isPending ? pendingLabel : label}
    </Button>
  );
}
