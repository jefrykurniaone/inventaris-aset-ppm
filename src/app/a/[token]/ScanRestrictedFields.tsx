import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { formatDate, formatDateTime } from "@/lib/format-date";
import { formatCurrencyIdr } from "@/lib/format-number";
import { ASSETS_PATH } from "@/lib/paths";

import type { ScanRestrictedRecord } from "./queries";
import { orNotSet, ScanField, ScanFieldGroup } from "./ScanFieldList";

/**
 * The RESTRICTED half of §8.2, rendered only when a session was found
 * (FR-6.3), together with the link through to the full record.
 *
 * This component is unreachable for an anonymous visitor by construction, not
 * by a condition it evaluates: it takes a `ScanRestrictedRecord`, and
 * `queries.ts` can only build one from a row the signed-in selection fetched.
 */
export async function ScanRestrictedFields({
  restricted,
}: Readonly<{ restricted: ScanRestrictedRecord }>) {
  const [locale, t, ts] = await Promise.all([
    getLocale(),
    getTranslations("AssetsPage"),
    getTranslations("ScanPage"),
  ]);
  const notSet = ts("notSet");

  const price =
    restricted.purchasePrice === null
      ? notSet
      : formatCurrencyIdr(Number(restricted.purchasePrice), locale);

  return (
    <div className="flex flex-col gap-6">
      <ScanFieldGroup
        headingId="scan-commercial-heading"
        heading={ts("commercialHeading")}
        note={ts("restrictedNote")}
      >
        <ScanField label={t("purchasePriceLabel")} value={price} />
        <ScanField
          label={t("fundingSourceLabel")}
          value={orNotSet(restricted.fundingSourceName, notSet)}
        />
        <ScanField
          label={t("procurementDocNoLabel")}
          value={orNotSet(restricted.procurementDocNo, notSet)}
        />
        <ScanField
          label={t("vendorLabel")}
          value={orNotSet(restricted.vendor, notSet)}
        />
        <ScanField
          label={t("warrantyUntilLabel")}
          value={
            restricted.warrantyUntil === null
              ? notSet
              : formatDate(restricted.warrantyUntil, locale)
          }
        />
      </ScanFieldGroup>

      <ScanFieldGroup
        headingId="scan-custody-heading"
        heading={ts("custodyHeading")}
      >
        <ScanField
          label={t("custodianNameLabel")}
          value={orNotSet(restricted.custodianName, notSet)}
        />
        <ScanField
          label={t("custodianEmailLabel")}
          value={orNotSet(restricted.custodianEmail, notSet)}
        />
        <ScanField
          label={ts("createdByLabel")}
          value={restricted.createdByName}
        />
        <ScanField
          label={ts("createdAtLabel")}
          value={formatDateTime(restricted.createdAt, locale)}
        />
        <ScanField
          label={ts("updatedAtLabel")}
          value={formatDateTime(restricted.updatedAt, locale)}
        />
      </ScanFieldGroup>

      {/* A plain styled `<Link>` rather than `<Button asChild>`. The shadcn
          button pulls Radix's `Slot` into the bundle, and this is the one
          route with a 2.5 s budget on a mid-range Android over 4G — a link
          that looks like a button is not worth the kilobytes here. It is a
          real `<a>`, so it is focusable and activates on Enter. */}
      <Link
        href={`${ASSETS_PATH}/${restricted.assetId}`}
        className="border-border hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring inline-flex h-9 w-fit items-center rounded-md border px-4 text-sm font-medium focus-visible:ring-2 focus-visible:outline-none"
      >
        {ts("openFullRecord")}
      </Link>
    </div>
  );
}
