import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import {
  CONDITION_LABEL_KEYS,
  STATUS_LABEL_KEYS,
} from "@/app/(app)/assets/asset-field-specs";
import type { ScanAudience } from "@/lib/asset-visibility";
import { getSessionUser } from "@/lib/require-user";
import { buildScanPath } from "@/lib/scan-url";

import {
  findAssetByQrToken,
  type ScanAssetRecord,
  type ScanPhoto,
  type WithdrawnScanSummary,
} from "./queries";
import { parseScanToken, parseSelectedPhotoId } from "./schemas";
import { ScanLoanNotice } from "./ScanLoanNotice";
import { ScanPageShell } from "./ScanPageShell";
import { ScanPhotoGallery } from "./ScanPhotoGallery";
import { ScanPublicFields } from "./ScanPublicFields";
import { ScanRestrictedFields } from "./ScanRestrictedFields";

/**
 * The public scan page (PRD FR-6.1 to FR-6.3, issue #11). `GET /a/<qrToken>`,
 * no session required, server-rendered, and deliberately outside the `(app)`
 * route group — nesting a page under that group is what "protected" means in
 * this codebase, and this one must answer a phone that has never signed in.
 *
 * Every part of it is a Server Component. Nothing on the page needs the
 * browser to run JavaScript to show its content: the gallery changes photo
 * through an ordinary link with a search param, and the only client component
 * anywhere on it is the locale switcher's `<select>`, which is a control
 * rather than content. That is a requirement, not an accident — a scanned
 * label opens in whatever in-app browser the scanner app embeds, on whatever
 * connection the corridor has.
 *
 * Three outcomes, and the difference between them matters:
 *
 *  - unknown token — `notFound()`, and `./not-found.tsx` says the same thing
 *    for a token that never existed as for one mistyped, so an anonymous
 *    caller learns nothing about the register either way;
 *  - soft-deleted asset — the "record withdrawn" state, **not** a 404
 *    (FR-2.5): a printed label outlives the row, and a scan of a retired item
 *    must not be a dead end;
 *  - otherwise the record, public half always, restricted half only when
 *    `getSessionUser` found a session.
 */

interface ScanPageProps {
  readonly params: Promise<{ readonly token: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** Which photo the page shows full size: the one asked for by `?photo=`, or
 * the primary one. A photo id belonging to another asset simply misses, so a
 * hand-edited URL cannot pull an image out of a different record. */
function resolveSelectedPhoto(
  photos: readonly ScanPhoto[],
  requestedId: string | null,
): ScanPhoto | null {
  if (photos.length === 0) {
    return null;
  }
  if (requestedId === null) {
    return photos[0];
  }
  return photos.find((photo) => photo.id === requestedId) ?? photos[0];
}

async function ScanAssetHeader({
  asset,
}: Readonly<{ asset: ScanAssetRecord }>) {
  const t = await getTranslations("AssetsPage");

  return (
    <header className="flex flex-col gap-1">
      <span className="text-muted-foreground font-mono text-sm">
        {asset.assetCode}
      </span>
      <h1 className="text-2xl font-semibold tracking-tight">{asset.name}</h1>
      <p className="text-muted-foreground text-sm">
        {t(STATUS_LABEL_KEYS[asset.status])} ·{" "}
        {t(CONDITION_LABEL_KEYS[asset.condition])}
      </p>
    </header>
  );
}

async function ScanEmptyGallery() {
  const tPhotos = await getTranslations("AssetPhotos");

  return (
    <p className="text-muted-foreground text-sm">{tPhotos("emptyState")}</p>
  );
}

async function WithdrawnScanView({
  asset,
}: Readonly<{ asset: WithdrawnScanSummary }>) {
  const ts = await getTranslations("ScanPage");

  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-2xl font-semibold tracking-tight">
        {ts("withdrawnTitle")}
      </h1>
      <p className="text-muted-foreground">
        {ts("withdrawnDescription", {
          assetCode: asset.assetCode,
          name: asset.name,
        })}
      </p>
    </div>
  );
}

function ScanAssetView({
  asset,
  selectedPhoto,
  scanPath,
}: Readonly<{
  asset: ScanAssetRecord;
  selectedPhoto: ScanPhoto | null;
  scanPath: string;
}>) {
  return (
    <>
      <ScanAssetHeader asset={asset} />
      {selectedPhoto ? (
        <ScanPhotoGallery
          photos={asset.photos}
          selected={selectedPhoto}
          assetName={asset.name}
          categoryName={asset.categoryName}
          scanPath={scanPath}
        />
      ) : (
        <ScanEmptyGallery />
      )}
      {asset.openLoan ? <ScanLoanNotice loan={asset.openLoan} /> : null}
      <ScanPublicFields asset={asset} />
      {asset.restricted ? (
        <ScanRestrictedFields restricted={asset.restricted} />
      ) : null}
    </>
  );
}

export default async function ScanPage({
  params,
  searchParams,
}: Readonly<ScanPageProps>) {
  const { token: rawToken } = await params;
  const token = parseScanToken(rawToken);
  if (token === null) {
    notFound();
  }

  const user = await getSessionUser();
  const audience: ScanAudience = user ? "signedIn" : "anonymous";
  const result = await findAssetByQrToken(token, audience);

  if (result.kind === "not_found") {
    notFound();
  }
  if (result.kind === "withdrawn") {
    return (
      <ScanPageShell>
        <WithdrawnScanView asset={result} />
      </ScanPageShell>
    );
  }

  const { photo } = await searchParams;
  const selectedPhoto = resolveSelectedPhoto(
    result.asset.photos,
    parseSelectedPhotoId(photo),
  );

  return (
    <ScanPageShell>
      <ScanAssetView
        asset={result.asset}
        selectedPhoto={selectedPhoto}
        scanPath={buildScanPath(token)}
      />
    </ScanPageShell>
  );
}
