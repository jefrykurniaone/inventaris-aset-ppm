import { getTranslations } from "next-intl/server";

import {
  assetExportFileName,
  isAssetExportTooLarge,
  MAX_ASSET_EXPORT_ROWS,
} from "@/lib/asset-export";
import { assetExportColumnsFor } from "@/lib/asset-export-columns";
import { createActionErrorLogger } from "@/lib/log-error";
import { requireUser } from "@/lib/require-user";
import { ADMIN_ROLE } from "@/lib/roles";

import { assetListSearchParamsSchema } from "../list-schemas";
import { buildAssetExportLabels, buildAssetExportHeaders } from "./messages";
import { countAssetExportRows, type AssetExportQueryInput } from "./queries";
import { buildAssetExportStream } from "./workbook";

/**
 * `GET /assets/export` — the filtered asset list as an XLSX download
 * (issue #14).
 *
 * A route handler rather than a server action, because a server action cannot
 * return a streamed file body. It is reached from a plain link carrying the
 * list's current query string, so it is keyboard-accessible by construction
 * and needs no client JavaScript.
 *
 * Authorisation is `requireUser()`, the same boundary every other signed-in
 * surface uses: a request with no session is redirected to the sign-in page
 * rather than handed a file. The `admin`/`staff` split is not a second check
 * here — it selects which of the two query shapes runs, in
 * `./queries.ts`, so a staff request never fetches a restricted column.
 */

const XLSX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const PLAIN_TEXT_CONTENT_TYPE = "text/plain; charset=utf-8";
const PAYLOAD_TOO_LARGE = 413;
const INTERNAL_ERROR = 500;

const logExportError = createActionErrorLogger(
  "src/app/(app)/assets/export/route.ts",
);

/**
 * The list's parsed params, minus paging. The export carries the filters and
 * the sort the user is looking at and the whole matching set — `page` and
 * `pageSize` describe the screen, not the selection.
 */
function toExportQueryInput(
  params: ReturnType<typeof assetListSearchParamsSchema.parse>,
): AssetExportQueryInput {
  return {
    search: params.q,
    categoryId: params.categoryId,
    buildingId: params.buildingId,
    roomId: params.roomId,
    status: params.status,
    condition: params.condition,
    acquisitionYear: params.acquisitionYear,
    fundingSourceId: params.fundingSourceId,
    attention: params.attention,
    sortKey: params.sort,
    sortDirection: params.dir,
  };
}

function messageResponse(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": PLAIN_TEXT_CONTENT_TYPE,
      "Cache-Control": "no-store",
    },
  });
}

function downloadResponse(
  stream: ReadableStream<Uint8Array>,
  fileName: string,
): Response {
  return new Response(stream, {
    headers: {
      "Content-Type": XLSX_CONTENT_TYPE,
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(request: Request): Promise<Response> {
  const user = await requireUser();
  const t = await getTranslations("AssetsPage");
  const tExport = await getTranslations("AssetExport");
  const searchParams = new URL(request.url).searchParams;
  const params = assetListSearchParamsSchema.parse(
    Object.fromEntries(searchParams),
  );
  const query = toExportQueryInput(params);

  try {
    const totalCount = await countAssetExportRows(query);
    if (isAssetExportTooLarge(totalCount)) {
      const message = tExport("tooLarge", {
        max: MAX_ASSET_EXPORT_ROWS,
        count: totalCount,
      });
      return messageResponse(message, PAYLOAD_TOO_LARGE);
    }

    const isAdmin = user.role === ADMIN_ROLE;
    const columns = assetExportColumnsFor(isAdmin);
    const stream = await buildAssetExportStream({
      query,
      isAdmin,
      columns,
      headers: buildAssetExportHeaders(columns, t),
      labels: buildAssetExportLabels(t),
      sheetName: tExport("sheetName"),
    });
    return downloadResponse(stream, assetExportFileName(new Date()));
  } catch (error) {
    logExportError("GET", params, error);
    return messageResponse(t("unexpectedError"), INTERNAL_ERROR);
  }
}
