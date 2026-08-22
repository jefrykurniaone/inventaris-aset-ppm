import { getTranslations } from "next-intl/server";

import {
  CONDITION_LABEL_KEYS,
  STATUS_LABEL_KEYS,
} from "@/app/(app)/assets/asset-field-specs";
import { formatYear } from "@/lib/format-number";

import type { ScanAssetRecord } from "./queries";
import { orNotSet, ScanField, ScanFieldGroup } from "./ScanFieldList";

/**
 * Everything §8.2 marks PUBLIC, which is everything an anonymous visitor sees
 * besides the photos and the loan notice.
 *
 * The two label maps come from `@/app/(app)/assets/asset-field-specs`, which
 * imports one `next-intl` *type* and the plain enums in `../schemas` and
 * nothing else — no session-only code follows them onto this public route.
 * Restating the eight status and condition labels here instead would put the
 * same eight strings in two catalogues and let them drift.
 */
export async function ScanPublicFields({
  asset,
}: Readonly<{ asset: ScanAssetRecord }>) {
  const [t, ts] = await Promise.all([
    getTranslations("AssetsPage"),
    getTranslations("ScanPage"),
  ]);
  const notSet = ts("notSet");

  return (
    <div className="flex flex-col gap-6">
      <ScanFieldGroup
        headingId="scan-identity-heading"
        heading={ts("identityHeading")}
      >
        <ScanField label={t("assetCodeLabel")} value={asset.assetCode} />
        <ScanField label={t("categoryLabel")} value={asset.categoryName} />
        <ScanField
          label={t("brandLabel")}
          value={orNotSet(asset.brand, notSet)}
        />
        <ScanField
          label={t("modelLabel")}
          value={orNotSet(asset.model, notSet)}
        />
        <ScanField
          label={t("serialNumberLabel")}
          value={orNotSet(asset.serialNumber, notSet)}
        />
        <ScanField
          label={t("universityAssetCodeLabel")}
          value={orNotSet(asset.universityAssetCode, notSet)}
        />
        <ScanField
          label={t("acquisitionYearLabel")}
          value={formatYear(asset.acquisitionYear)}
        />
        <ScanField
          label={t("notesLabel")}
          value={orNotSet(asset.notes, notSet)}
        />
      </ScanFieldGroup>

      <ScanFieldGroup
        headingId="scan-location-heading"
        heading={ts("locationHeading")}
      >
        <ScanField
          label={t("filterBuildingLabel")}
          value={asset.buildingName}
        />
        <ScanField label={t("roomLabel")} value={asset.roomName} />
        <ScanField
          label={t("statusLabel")}
          value={t(STATUS_LABEL_KEYS[asset.status])}
        />
        <ScanField
          label={t("conditionLabel")}
          value={t(CONDITION_LABEL_KEYS[asset.condition])}
        />
      </ScanFieldGroup>
    </div>
  );
}
