"use client";

import { useActionState } from "react";

import { FormError } from "@/components/FormError";
import { SubmitButton } from "@/components/SubmitButton";

import { INITIAL_RETURN_LOAN_STATE, type ReturnLoanState } from "./schemas";

/**
 * The return control (PRD FR-6.1). One button and one hidden loan id: a return
 * has nothing to fill in, because when the item came back is now and who took
 * it back is the signed-in user.
 *
 * No confirmation step, unlike deletion. A return is corrective rather than
 * destructive — the loan row keeps every date it had, and a mistaken return is
 * fixed by checking the item out again — so an extra dialogue would cost a
 * click on the register's most frequent action and prevent nothing.
 *
 * A Client Component only so the refusal from a loan somebody else already
 * returned can be shown in place rather than swallowed.
 */

export type ReturnLoanAction = (
  state: ReturnLoanState,
  formData: FormData,
) => Promise<ReturnLoanState>;

interface ReturnLoanFormProps {
  readonly action: ReturnLoanAction;
  readonly loanId: string;
  readonly submitLabel: string;
  readonly submitPendingLabel: string;
}

export function ReturnLoanForm({
  action,
  loanId,
  submitLabel,
  submitPendingLabel,
}: Readonly<ReturnLoanFormProps>) {
  const [state, formAction] = useActionState(action, INITIAL_RETURN_LOAN_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="loanId" value={loanId} />
      <div>
        <SubmitButton
          idleLabel={submitLabel}
          pendingLabel={submitPendingLabel}
        />
      </div>
      <FormError message={state.formError} />
    </form>
  );
}
