"use client";

import type { ReactNode } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ConfirmDialogProps {
  readonly trigger: ReactNode;
  readonly title: string;
  readonly description: string;
  readonly cancelLabel: string;
  readonly confirmLabel: string;
  readonly action: (formData: FormData) => void | Promise<void>;
  readonly hiddenFields: Readonly<Record<string, string>>;
}

/**
 * A destructive-action confirmation step, built from Radix's `AlertDialog`
 * rather than the browser's `confirm()` (the ticket's explicit constraint):
 * keyboard operable — Escape cancels, focus starts on Cancel per the
 * WAI-ARIA `alertdialog` pattern Radix implements, Tab reaches the confirm
 * button — localised via the caller's own translated strings, and
 * cancellable. The confirm button is a real submit button inside a real
 * `<form action>`, so the server action's own `requireAdmin()` stays the
 * authorisation boundary; this component only gates whether the request is
 * ever sent, the same way a disabled input never is.
 */
export function ConfirmDialog({
  trigger,
  title,
  description,
  cancelLabel,
  confirmLabel,
  action,
  hiddenFields,
}: Readonly<ConfirmDialogProps>) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <form action={action}>
          {Object.entries(hiddenFields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <AlertDialogFooter>
            <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
            <AlertDialogAction type="submit" variant="destructive">
              {confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
