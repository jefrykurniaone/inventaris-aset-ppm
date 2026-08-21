"use client";

import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

interface SubmitButtonProps {
  readonly idleLabel: string;
  readonly pendingLabel: string;
  readonly variant?: ComponentProps<typeof Button>["variant"];
}

/**
 * A form's submit button, shared by every plain `<form action={...}>` in the
 * application shell (the admin user table's deactivate/reactivate rows) so
 * each one disables itself and announces `aria-busy` while its action is in
 * flight, without needing its own client-side state. `useFormStatus` only
 * reports the status of the nearest enclosing `<form>`, so this component
 * has to be rendered inside one.
 */
export function SubmitButton({
  idleLabel,
  pendingLabel,
  variant,
}: Readonly<SubmitButtonProps>) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant={variant}
      disabled={pending}
      aria-busy={pending}
    >
      {pending ? pendingLabel : idleLabel}
    </Button>
  );
}
