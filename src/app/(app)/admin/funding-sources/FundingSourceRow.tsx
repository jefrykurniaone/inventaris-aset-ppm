import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { DeleteControl } from "@/components/DeleteControl";
import { SubmitButton } from "@/components/SubmitButton";
import { Button } from "@/components/ui/button";

import {
  deactivateFundingSourceAction,
  deleteFundingSourceAction,
  reactivateFundingSourceAction,
} from "./actions";
import type { FundingSourceListRow } from "./queries";

type AdminFundingSourcesT = Awaited<
  ReturnType<typeof getTranslations<"AdminFundingSourcesPage">>
>;

interface FundingSourceRowProps {
  readonly fundingSource: FundingSourceListRow;
  readonly t: AdminFundingSourcesT;
}

/** The deactivate/reactivate toggle — reversible, so no confirmation step. */
function ActiveToggle({ fundingSource, t }: Readonly<FundingSourceRowProps>) {
  const action = fundingSource.isActive
    ? deactivateFundingSourceAction
    : reactivateFundingSourceAction;
  const idleLabel = fundingSource.isActive ? t("deactivate") : t("reactivate");
  const pendingLabel = fundingSource.isActive
    ? t("deactivatePending")
    : t("reactivatePending");

  return (
    <form action={action}>
      <input type="hidden" name="id" value={fundingSource.id} />
      <SubmitButton
        variant="outline"
        idleLabel={idleLabel}
        pendingLabel={pendingLabel}
      />
    </form>
  );
}

/** Delete is only offered when no asset uses this funding source yet (PRD
 * FR-3.4); `deleteFundingSourceAction` re-checks that atomically. */
function DeleteOrReferencedNote({
  fundingSource,
  t,
}: Readonly<FundingSourceRowProps>) {
  if (fundingSource.assetCount > 0) {
    return (
      <span className="text-muted-foreground text-sm">
        {t("referencedByAssets", { count: fundingSource.assetCount })}
      </span>
    );
  }

  return (
    <DeleteControl
      action={deleteFundingSourceAction}
      id={fundingSource.id}
      triggerLabel={t("delete")}
      pendingLabel={t("deletePending")}
      title={t("deleteConfirmTitle", { name: fundingSource.name })}
      description={t("deleteConfirmDescription")}
      cancelLabel={t("cancel")}
      confirmLabel={t("deleteConfirm")}
    />
  );
}

/** One row of the funding source list, split out of `FundingSourceTable` to
 * keep every function in this feature under the project's 40-line limit. */
export function FundingSourceRow({
  fundingSource,
  t,
}: Readonly<FundingSourceRowProps>) {
  return (
    <tr className="border-border border-b align-top">
      <td className="py-2 pr-4">{fundingSource.name}</td>
      <td className="py-2 pr-4">{fundingSource.notes ?? ""}</td>
      <td className="py-2 pr-4">
        {fundingSource.isActive ? t("statusActive") : t("statusDeactivated")}
      </td>
      <td className="py-2 pr-4">
        <Button asChild variant="outline" size="sm">
          <Link href={`/admin/funding-sources/${fundingSource.id}`}>
            {t("edit")}
          </Link>
        </Button>
      </td>
      <td className="py-2 pr-4">
        <ActiveToggle fundingSource={fundingSource} t={t} />
      </td>
      <td className="py-2">
        <DeleteOrReferencedNote fundingSource={fundingSource} t={t} />
      </td>
    </tr>
  );
}
