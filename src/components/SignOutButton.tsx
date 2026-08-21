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
 * still live.
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
