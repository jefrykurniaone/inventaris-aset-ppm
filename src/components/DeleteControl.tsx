"use client";

import { useActionState } from "react";

import {
  INITIAL_DELETE_STATE,
  type DeleteState,
} from "@/app/(app)/admin/delete-state";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { FormError } from "@/components/FormError";
import { Button } from "@/components/ui/button";

export type { DeleteState };

interface DeleteControlProps {
  readonly action: (
    state: DeleteState,
    formData: FormData,
  ) => Promise<DeleteState>;
  readonly id: string;
  readonly triggerLabel: string;
  readonly pendingLabel: string;
  readonly title: string;
  readonly description: string;
  readonly cancelLabel: string;
  readonly confirmLabel: string;
}

/**
 * The delete control for one master-data row: a trigger button, a
 * `ConfirmDialog`, and the resulting error — if the delete was refused
 * because the row is still referenced, including by the race described in
 * `src/lib/prisma-errors.ts` — rendered underneath. `useActionState` reads
 * that error back once the dialog itself has already closed, which is why
 * it is not shown inside the dialog.
 */
export function DeleteControl({
  action,
  id,
  triggerLabel,
  pendingLabel,
  title,
  description,
  cancelLabel,
  confirmLabel,
}: Readonly<DeleteControlProps>) {
  const [state, formAction, isPending] = useActionState(
    action,
    INITIAL_DELETE_STATE,
  );

  return (
    <div className="flex flex-col items-end gap-1">
      <ConfirmDialog
        trigger={
          <Button variant="destructive" size="sm" disabled={isPending}>
            {isPending ? pendingLabel : triggerLabel}
          </Button>
        }
        title={title}
        description={description}
        cancelLabel={cancelLabel}
        confirmLabel={confirmLabel}
        action={formAction}
        hiddenFields={{ id }}
      />
      <FormError message={state.formError} />
    </div>
  );
}
