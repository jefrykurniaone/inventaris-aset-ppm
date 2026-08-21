import { getTranslations } from "next-intl/server";

import { requireAdmin } from "@/lib/require-user";

import { createFundingSourceAction } from "./actions";
import { FundingSourceForm } from "./FundingSourceForm";
import { FundingSourceTable } from "./FundingSourceTable";
import { listFundingSources } from "./queries";

/**
 * Admin-only funding source management (PRD FR-3.1): list, create, edit
 * (via `[id]/page.tsx`) and deactivate.
 */
export default async function AdminFundingSourcesPage() {
  await requireAdmin();
  const t = await getTranslations("AdminFundingSourcesPage");
  const fundingSources = await listFundingSources();

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <FundingSourceForm
        action={createFundingSourceAction}
        heading={t("createHeading")}
        submitLabel={t("createSubmit")}
        submitPendingLabel={t("createSubmitPending")}
        nameLabel={t("nameLabel")}
        notesLabel={t("notesLabel")}
      />
      <FundingSourceTable fundingSources={fundingSources} t={t} />
    </div>
  );
}
