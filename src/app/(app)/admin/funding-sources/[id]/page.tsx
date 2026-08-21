import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/require-user";

import { updateFundingSourceAction } from "../actions";
import { FundingSourceForm } from "../FundingSourceForm";

interface EditFundingSourcePageProps {
  readonly params: Promise<{ readonly id: string }>;
}

/** Funding source edit page (PRD FR-3.1). */
export default async function EditFundingSourcePage({
  params,
}: Readonly<EditFundingSourcePageProps>) {
  await requireAdmin();
  const { id } = await params;
  const t = await getTranslations("AdminFundingSourcesPage");

  const fundingSource = await db.fundingSource.findUnique({ where: { id } });
  if (!fundingSource) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/admin/funding-sources"
        className="text-primary text-sm hover:underline"
      >
        {t("backToList")}
      </Link>
      <FundingSourceForm
        action={updateFundingSourceAction}
        heading={t("editHeading")}
        submitLabel={t("editSubmit")}
        submitPendingLabel={t("editSubmitPending")}
        nameLabel={t("nameLabel")}
        notesLabel={t("notesLabel")}
        id={fundingSource.id}
        defaultName={fundingSource.name}
        defaultNotes={fundingSource.notes}
      />
    </div>
  );
}
