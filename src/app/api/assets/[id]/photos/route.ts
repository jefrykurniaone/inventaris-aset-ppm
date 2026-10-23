import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";

import { createActionErrorLogger } from "@/lib/log-error";
import { ASSETS_PATH } from "@/lib/paths";
import { getSessionUser } from "@/lib/require-user";

import {
  PHOTO_MESSAGE_VALUES,
  type PhotoTranslate,
} from "@/app/(app)/assets/photos/action-messages";
import { insertPhoto } from "@/app/(app)/assets/photos/mutations";
import type { PhotoUploadResponse } from "@/app/(app)/assets/photos/schemas";

import {
  isSameOriginRequest,
  isUploadRefusal,
  readUpload,
  type AcceptedUpload,
} from "./upload-request";

/**
 * `POST /api/assets/<id>/photos` — adds one photo to an asset (ADR 0009,
 * issue #163).
 *
 * A route handler rather than a server action, because a server action gives
 * the browser neither upload progress nor cancellation, and raising the
 * server-action body limit for this one request would raise it for every
 * action. The browser sends one multipart request per photo over XHR, with
 * four parts: `full` and `thumbnail` (the two derivatives the browser
 * compressed), and `width` and `height` (the full image's dimensions).
 *
 * The steps run in this order, and each refuses before the next one starts:
 *
 * 1. **A signed-in user**, by the rule every photo action uses —
 *    `getSessionUser()`, which `requireUser()` is built on, so a banned user
 *    counts as signed out. The only difference is the answer: a route called
 *    by XHR gets a 401 it can show, rather than `requireUser()`'s redirect,
 *    which the XHR would silently follow and re-send the photo to.
 * 2. **The application's own `Origin`**, or 403 (`isSameOriginRequest`). A
 *    route handler gets none of a server action's CSRF protection.
 * 3. **A body of at most `MAX_UPLOAD_BODY_BYTES`**, or 413 — refused from
 *    `Content-Length` before it is read, and capped again while it is read.
 * 4. **Valid fields** (`photoUploadFormSchema`, shared with the browser), or
 *    400.
 * 5. **Images that are what they say they are**, identified from their
 *    leading bytes (`inspectPhotoPart`), or 415, 413 or 400.
 * 6. **One transaction** (`insertPhoto`): lock the live asset, enforce the
 *    five-photo limit, create the row with the size the server measured,
 *    write the bytes through `src/lib/storage.ts`, and record `photo_added`.
 *
 * ## Response
 *
 * Always JSON, always `Cache-Control: no-store`, always the shape of
 * `photoUploadResponseSchema`:
 *
 * - `201 { ok: true, value: { photoId } }` — the photo and its bytes exist.
 * - `{ ok: false, message }` otherwise, where `message` is already localised
 *   and never internal error text, with the status saying which step refused:
 *   `400` invalid fields, a malformed body or an empty part
 *   (`invalidRequest`, `uploadIncomplete`); `401` no session and `403` a
 *   foreign origin (both `invalidRequest`, whose "reload the page" lands a
 *   signed-out user on the sign-in page); `404` the asset is missing or
 *   withdrawn (`assetNotFound`); `409` the asset already has five photos
 *   (`limitReached`); `413` the body or one image is too large (`tooLarge`);
 *   `415` an image is not JPEG, PNG or WebP, or its declared type disagrees
 *   with its bytes (`unsupportedFormat`); `500` the database failed
 *   (`storageUnavailable`).
 */

const CREATED = 201;
const UNAUTHORIZED = 401;
const FORBIDDEN = 403;
const NOT_FOUND = 404;
const CONFLICT = 409;
const INTERNAL_ERROR = 500;

const NO_STORE = "no-store";

type UploadMessage = Parameters<PhotoTranslate>[0];

interface Refusal {
  readonly status: number;
  readonly message: UploadMessage;
}

const SIGNED_OUT: Refusal = { status: UNAUTHORIZED, message: "invalidRequest" };
const FOREIGN_ORIGIN: Refusal = {
  status: FORBIDDEN,
  message: "invalidRequest",
};
const STORAGE_FAILED: Refusal = {
  status: INTERNAL_ERROR,
  message: "storageUnavailable",
};

const INSERT_REFUSALS = {
  NOT_FOUND: { status: NOT_FOUND, message: "assetNotFound" },
  LIMIT_REACHED: { status: CONFLICT, message: "limitReached" },
} as const satisfies Record<string, Refusal>;

const logUploadError = createActionErrorLogger(
  "src/app/api/assets/[id]/photos/route.ts",
);

interface RouteContext {
  readonly params: Promise<{ readonly id: string }>;
}

function jsonResponse(body: PhotoUploadResponse, status: number): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": NO_STORE },
  });
}

function refusalResponse(t: PhotoTranslate, refusal: Refusal): Response {
  return jsonResponse(
    { ok: false, message: t(refusal.message, PHOTO_MESSAGE_VALUES) },
    refusal.status,
  );
}

/** What is worth logging about an upload: everything but the bytes. */
function describeUpload(upload: AcceptedUpload): Record<string, unknown> {
  return {
    assetId: upload.assetId,
    width: upload.width,
    height: upload.height,
    fullContentType: upload.content.fullContentType,
    fullBytes: upload.content.fullBytes.length,
    thumbContentType: upload.content.thumbContentType,
    thumbBytes: upload.content.thumbBytes.length,
  };
}

async function storeUpload(
  t: PhotoTranslate,
  upload: AcceptedUpload,
  actorId: string,
): Promise<Response> {
  try {
    const result = await insertPhoto({ ...upload, actorId });
    if (!result.ok) {
      return refusalResponse(t, INSERT_REFUSALS[result.reason]);
    }
    revalidatePath(ASSETS_PATH);
    revalidatePath(`${ASSETS_PATH}/${upload.assetId}/edit`);
    return jsonResponse(
      { ok: true, value: { photoId: result.value.photoId } },
      CREATED,
    );
  } catch (error) {
    logUploadError("POST", describeUpload(upload), error);
    return refusalResponse(t, STORAGE_FAILED);
  }
}

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const user = await getSessionUser();
  const t = await getTranslations("AssetPhotos");
  if (!user) {
    return refusalResponse(t, SIGNED_OUT);
  }
  if (!isSameOriginRequest(request.headers)) {
    return refusalResponse(t, FOREIGN_ORIGIN);
  }

  const { id } = await context.params;
  const upload = await readUpload(request, id);
  if (isUploadRefusal(upload)) {
    return refusalResponse(t, upload);
  }
  return storeUpload(t, upload, user.id);
}
