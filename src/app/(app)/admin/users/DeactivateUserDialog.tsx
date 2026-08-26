"use client";

import { useActionState } from "react";

import { FieldError } from "@/components/FieldError";
import { FormError } from "@/components/FormError";
import { SubmitButton } from "@/components/SubmitButton";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { deactivateUserAction } from "./actions";
import {
  DEACTIVATION_REASON_MAX_LENGTH,
  INITIAL_DEACTIVATE_USER_STATE,
} from "./schemas";

/**
 * Every string this dialog renders, resolved by the server component that
 * renders it. Passing translated text rather than calling `useTranslations`
 * here keeps one `getTranslations("AdminUsersPage")` per request instead of
 * one per row, and the props stay plain strings across the server/client
 * boundary.
 */
export interface DeactivateUserLabels {
  readonly trigger: string;
  readonly pending: string;
  readonly title: string;
  readonly description: string;
  readonly reasonLabel: string;
  readonly cancel: string;
  readonly confirm: string;
}

interface DeactivateUserDialogProps {
  readonly userId: string;
  readonly labels: DeactivateUserLabels;
}

/**
 * The deactivate control for one user row: a trigger button and the dialog
 * that captures the required reason (issue #86).
 *
 * A plain `Dialog` rather than the `AlertDialog` behind `ConfirmDialog`:
 * Radix's `alertdialog` role moves initial focus to the cancel button, which
 * is right for a bare yes/no but wrong here — this dialog asks for input, so
 * focus belongs in the field. Both give a focus trap, Escape to close, and
 * focus returned to the trigger on close.
 *
 * The reason field's `required` and `maxLength` are conveniences. The rule is
 * `deactivateUserAction`'s own schema parse: `noValidate` hands an empty
 * submission straight to the server, so the localised message rendered below
 * is the server's answer and not the browser's tooltip.
 */
export function DeactivateUserDialog({
  userId,
  labels,
}: Readonly<DeactivateUserDialogProps>) {
  const [state, formAction] = useActionState(
    deactivateUserAction,
    INITIAL_DEACTIVATE_USER_STATE,
  );
  const reasonId = `deactivate-reason-${userId}`;
  const reasonErrorId = `${reasonId}-error`;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          {labels.trigger}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{labels.title}</DialogTitle>
          <DialogDescription>{labels.description}</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4" noValidate>
          <input type="hidden" name="userId" value={userId} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={reasonId}>{labels.reasonLabel}</Label>
            <Textarea
              id={reasonId}
              name="reason"
              required
              maxLength={DEACTIVATION_REASON_MAX_LENGTH}
              aria-invalid={Boolean(state.reasonError)}
              aria-describedby={state.reasonError ? reasonErrorId : undefined}
            />
            <FieldError
              id={reasonErrorId}
              message={state.reasonError ?? undefined}
            />
          </div>
          <FormError message={state.formError} />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                {labels.cancel}
              </Button>
            </DialogClose>
            <SubmitButton
              variant="destructive"
              idleLabel={labels.confirm}
              pendingLabel={labels.pending}
            />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
