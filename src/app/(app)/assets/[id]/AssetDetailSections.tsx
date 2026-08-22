import type { ReactNode } from "react";

import { getLocale, getTranslations } from "next-intl/server";

import type { Locale } from "@/i18n/config";
import { formatDate, formatDateTime } from "@/lib/format-date";
import { formatCurrencyIdr, formatYear } from "@/lib/format-number";

import { CONDITION_LABEL_KEYS, STATUS_LABEL_KEYS } from "../asset-field-specs";
import type { AssetDetailRecord } from "./queries";

/**
 * The four field groups issue #10 asks for: identity, location and
 * condition, commercial, custody. Both roles see every one of them — this is
 * an authenticated route, and PRD §8.2's public/restricted split belongs to
 * the public scan page (#11) and the export (#14), neither of which this
 * page is.
 */

type AssetsT = Awaited<ReturnType<typeof getTranslations<"AssetsPage">>>;
type DetailT = Awaited<ReturnType<typeof getTranslations<"AssetDetailPage">>>;

interface SectionProps {
  readonly asset: AssetDetailRecord;
  readonly t: AssetsT;
  readonly td: DetailT;
  readonly locale: Locale;
}

function DetailField({
  label,
  value,
}: Readonly<{ label: string; value: string }>) {
  return (
    <div>
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function DetailSection({
  headingId,
  heading,
  note,
  children,
}: Readonly<{
  headingId: string;
  heading: string;
  note?: string;
  children: ReactNode;
}>) {
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h2 id={headingId} className="text-lg font-semibold">
        {heading}
      </h2>
      {note ? <p className="text-muted-foreground text-sm">{note}</p> : null}
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        {children}
      </dl>
    </section>
  );
}

/** `null` reads as the localised "not set" everywhere in these sections —
 * one place to keep that consistent rather than a ternary at every field. */
function orEmpty(value: string | null, emptyText: string): string {
  return value ?? emptyText;
}

function IdentitySection({ asset, t, td }: Readonly<SectionProps>) {
  return (
    <DetailSection
      headingId="asset-identity-heading"
      heading={td("identityHeading")}
    >
      <DetailField label={t("assetCodeLabel")} value={asset.assetCode} />
      <DetailField label={t("nameLabel")} value={asset.name} />
      <DetailField label={t("categoryLabel")} value={asset.categoryName} />
      <DetailField
        label={t("brandLabel")}
        value={orEmpty(asset.brand, td("notSet"))}
      />
      <DetailField
        label={t("modelLabel")}
        value={orEmpty(asset.model, td("notSet"))}
      />
      <DetailField
        label={t("serialNumberLabel")}
        value={orEmpty(asset.serialNumber, td("notSet"))}
      />
      <DetailField
        label={t("universityAssetCodeLabel")}
        value={orEmpty(asset.universityAssetCode, td("notSet"))}
      />
      <DetailField
        label={t("acquisitionYearLabel")}
        value={formatYear(asset.acquisitionYear)}
      />
      <DetailField
        label={t("notesLabel")}
        value={orEmpty(asset.notes, td("notSet"))}
      />
    </DetailSection>
  );
}

function LocationConditionSection({ asset, t, td }: Readonly<SectionProps>) {
  return (
    <DetailSection
      headingId="asset-location-heading"
      heading={td("locationConditionHeading")}
    >
      <DetailField
        label={t("filterBuildingLabel")}
        value={asset.buildingName}
      />
      <DetailField label={t("roomLabel")} value={asset.roomName} />
      <DetailField
        label={t("statusLabel")}
        value={t(STATUS_LABEL_KEYS[asset.status])}
      />
      <DetailField
        label={t("conditionLabel")}
        value={t(CONDITION_LABEL_KEYS[asset.condition])}
      />
    </DetailSection>
  );
}

function CommercialSection({ asset, t, td, locale }: Readonly<SectionProps>) {
  const price =
    asset.purchasePrice === null
      ? td("notSet")
      : formatCurrencyIdr(Number(asset.purchasePrice), locale);

  return (
    <DetailSection
      headingId="asset-commercial-heading"
      heading={td("commercialHeading")}
      note={td("commercialNote")}
    >
      <DetailField label={t("purchasePriceLabel")} value={price} />
      <DetailField
        label={t("fundingSourceLabel")}
        value={orEmpty(asset.fundingSourceName, td("notSet"))}
      />
      <DetailField
        label={t("procurementDocNoLabel")}
        value={orEmpty(asset.procurementDocNo, td("notSet"))}
      />
      <DetailField
        label={t("vendorLabel")}
        value={orEmpty(asset.vendor, td("notSet"))}
      />
      <DetailField
        label={t("warrantyUntilLabel")}
        value={
          asset.warrantyUntil === null
            ? td("notSet")
            : formatDate(asset.warrantyUntil, locale)
        }
      />
    </DetailSection>
  );
}

function CustodySection({ asset, t, td, locale }: Readonly<SectionProps>) {
  return (
    <DetailSection
      headingId="asset-custody-heading"
      heading={td("custodyHeading")}
    >
      <DetailField
        label={t("custodianNameLabel")}
        value={orEmpty(asset.custodianName, td("notSet"))}
      />
      <DetailField
        label={t("custodianEmailLabel")}
        value={orEmpty(asset.custodianEmail, td("notSet"))}
      />
      <DetailField label={td("createdByLabel")} value={asset.createdByName} />
      <DetailField
        label={td("createdAtLabel")}
        value={formatDateTime(asset.createdAt, locale)}
      />
      <DetailField
        label={td("updatedAtLabel")}
        value={formatDateTime(asset.updatedAt, locale)}
      />
    </DetailSection>
  );
}

export async function AssetDetailSections({
  asset,
}: Readonly<{ asset: AssetDetailRecord }>) {
  const [locale, t, td] = await Promise.all([
    getLocale(),
    getTranslations("AssetsPage"),
    getTranslations("AssetDetailPage"),
  ]);
  const sectionProps: SectionProps = { asset, t, td, locale };

  return (
    <div className="flex flex-col gap-6">
      <IdentitySection {...sectionProps} />
      <LocationConditionSection {...sectionProps} />
      <CommercialSection {...sectionProps} />
      <CustodySection {...sectionProps} />
    </div>
  );
}
