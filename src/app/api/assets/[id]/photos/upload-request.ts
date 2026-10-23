import {
  inspectPhotoPart,
  MAX_UPLOAD_BODY_BYTES,
  type PhotoAcceptance,
  type PhotoRejection,
} from "@/lib/photo-upload";
import { createActionErrorLogger } from "@/lib/log-error";
import type { PhotoContent } from "@/lib/storage";

import {
  PHOTO_UPLOAD_FIELD,
  photoUploadFormSchema,
  type PhotoUploadForm,
} from "@/app/(app)/assets/photos/schemas";

/**
 * Everything the upload route checks about a request before it opens a
 * transaction (ADR 0009, issue #163): where the request came from, how large
 * its body is, what its fields are, and what its two images really are.
 *
 * Kept apart from `route.ts` so each check is a small function with its own
 * test, and so the route reads as the ordered list of steps it is. Nothing
 * here reads a session or writes a row.
 */

const BAD_REQUEST = 400;
const PAYLOAD_TOO_LARGE = 413;
const UNSUPPORTED_MEDIA_TYPE = 415;

/** The `AssetPhotos` message a refusal is shown as. Every member is a key of
 * that namespace, which `route.ts` translates. */
export type UploadRefusalMessage =
  "invalidRequest" | "tooLarge" | "unsupportedFormat" | "uploadIncomplete";

export interface UploadRefusal {
  readonly status: number;
  readonly message: UploadRefusalMessage;
}

/** A request that passed every check, ready for the transaction. */
export interface AcceptedUpload {
  readonly assetId: string;
  readonly width: number;
  readonly height: number;
  readonly content: PhotoContent;
}

const INVALID_UPLOAD: UploadRefusal = {
  status: BAD_REQUEST,
  message: "invalidRequest",
};

const OVERSIZE_UPLOAD: UploadRefusal = {
  status: PAYLOAD_TOO_LARGE,
  message: "tooLarge",
};

const INCOMPLETE_UPLOAD: UploadRefusal = {
  status: BAD_REQUEST,
  message: "uploadIncomplete",
};

const REFUSAL_BY_REJECTION: Readonly<Record<PhotoRejection, UploadRefusal>> = {
  UNSUPPORTED_TYPE: {
    status: UNSUPPORTED_MEDIA_TYPE,
    message: "unsupportedFormat",
  },
  TOO_LARGE: OVERSIZE_UPLOAD,
  EMPTY: INCOMPLETE_UPLOAD,
};

const logUploadRequestError = createActionErrorLogger(
  "src/app/api/assets/[id]/photos/upload-request.ts",
);

const FORWARDED_HOST_HEADER = "x-forwarded-host";
const FORWARDED_LIST_SEPARATOR = ",";

/** A `Content-Length` value is a run of decimal digits and nothing else. */
const CONTENT_LENGTH_PATTERN = /^\d+$/;

/**
 * The host this request was addressed to, read the way Next.js reads it for
 * its own server-action CSRF check (`parseHostHeader` in
 * `next/dist/server/app-render/action-handler.js`): the first
 * `X-Forwarded-Host` entry when a proxy set one, otherwise `Host`.
 */
function addressedHost(headers: Headers): string | null {
  const forwarded = headers
    .get(FORWARDED_HOST_HEADER)
    ?.split(FORWARDED_LIST_SEPARATOR)[0]
    ?.trim();
  if (forwarded) {
    return forwarded.toLowerCase();
  }
  const host = headers.get("host");
  return host ? host.toLowerCase() : null;
}

/**
 * Whether the request's `Origin` is this application's own.
 *
 * A route handler gets none of the CSRF protection Next.js gives a server
 * action, so this is that check, made explicitly and made stricter: a missing
 * `Origin`, an opaque `null` one, or one that does not parse is refused
 * outright, where Next.js lets a missing one through. Every browser sends
 * `Origin` on a `POST`, and the only client of this route is the
 * application's own XHR, so nothing legitimate is refused by that.
 */
export function isSameOriginRequest(headers: Headers): boolean {
  const origin = headers.get("origin");
  const host = addressedHost(headers);
  if (origin === null || host === null || !URL.canParse(origin)) {
    return false;
  }
  return new URL(origin).host === host;
}

/**
 * Whether the declared `Content-Length` already rules the body out, so it can
 * be refused before a byte of it is read. A length that is not a plain
 * decimal number is refused too: there is no honest reason to send one, and
 * a value that cannot be compared cannot be trusted to be small.
 *
 * An absent header is not a refusal. A chunked body declares no length, and
 * `readBodyWithinCap` enforces the cap on that one as it reads.
 */
export function declaresOversizeBody(
  headers: Headers,
  maxBytes: number = MAX_UPLOAD_BODY_BYTES,
): boolean {
  const declared = headers.get("content-length");
  if (declared === null) {
    return false;
  }
  return !CONTENT_LENGTH_PATTERN.test(declared) || Number(declared) > maxBytes;
}

function concatenate(
  chunks: readonly Uint8Array[],
  totalBytes: number,
): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}

/**
 * Reads a request body, or answers `null` the moment it grows past
 * `maxBytes`.
 *
 * The count is taken chunk by chunk as the stream delivers them, and the
 * stream is cancelled as soon as the running total passes the cap, so at most
 * one chunk beyond the cap is ever held and the rest of the body is never
 * read. This is the enforcement; the `Content-Length` check above only lets
 * an honest oversize request be refused without reading anything at all.
 */
export async function readBodyWithinCap(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number = MAX_UPLOAD_BODY_BYTES,
): Promise<Uint8Array<ArrayBuffer> | null> {
  if (body === null) {
    return new Uint8Array(0);
  }
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  let next = await reader.read();
  while (!next.done) {
    totalBytes += next.value.length;
    if (totalBytes > maxBytes) {
      await reader.cancel("upload body exceeds the cap");
      return null;
    }
    chunks.push(next.value);
    next = await reader.read();
  }
  return concatenate(chunks, totalBytes);
}

/** Parses a buffered multipart body with the platform's own parser, or
 * answers `null` when it is not one. */
async function parseMultipart(
  bytes: Uint8Array<ArrayBuffer>,
  contentType: string | null,
): Promise<FormData | null> {
  try {
    return await new Response(bytes, {
      headers: { "content-type": contentType ?? "" },
    }).formData();
  } catch (error) {
    logUploadRequestError(
      "parseMultipart",
      { contentType, bodyBytes: bytes.length },
      error,
    );
    return null;
  }
}

function formInput(assetId: string, form: FormData): Record<string, unknown> {
  return {
    assetId,
    full: form.get(PHOTO_UPLOAD_FIELD.full),
    thumbnail: form.get(PHOTO_UPLOAD_FIELD.thumbnail),
    width: form.get(PHOTO_UPLOAD_FIELD.width),
    height: form.get(PHOTO_UPLOAD_FIELD.height),
  };
}

async function inspectFile(
  file: File,
): Promise<{ bytes: Uint8Array<ArrayBuffer>; acceptance: PhotoAcceptance }> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  return {
    bytes,
    acceptance: inspectPhotoPart({ declaredType: file.type, bytes }),
  };
}

/**
 * Identifies both images from their bytes (`inspectPhotoPart`). The full
 * image is reported first when both are wrong, because it is the one the
 * user picked; the thumbnail is derived from it.
 */
async function inspectUpload(
  form: PhotoUploadForm,
): Promise<AcceptedUpload | UploadRefusal> {
  const [full, thumb] = await Promise.all([
    inspectFile(form.full),
    inspectFile(form.thumbnail),
  ]);
  if (!full.acceptance.isAccepted) {
    return REFUSAL_BY_REJECTION[full.acceptance.rejection];
  }
  if (!thumb.acceptance.isAccepted) {
    return REFUSAL_BY_REJECTION[thumb.acceptance.rejection];
  }
  return {
    assetId: form.assetId,
    width: form.width,
    height: form.height,
    content: {
      fullBytes: full.bytes,
      fullContentType: full.acceptance.contentType,
      thumbBytes: thumb.bytes,
      thumbContentType: thumb.acceptance.contentType,
    },
  };
}

/** Reads the body within the cap, answering a refusal for an oversize body
 * and for one whose transfer broke off part-way. */
async function readCappedBody(
  request: Request,
  assetId: string,
): Promise<Uint8Array<ArrayBuffer> | UploadRefusal> {
  if (declaresOversizeBody(request.headers)) {
    return OVERSIZE_UPLOAD;
  }
  try {
    return (await readBodyWithinCap(request.body)) ?? OVERSIZE_UPLOAD;
  } catch (error) {
    logUploadRequestError("readCappedBody", { assetId }, error);
    return INCOMPLETE_UPLOAD;
  }
}

export function isUploadRefusal(
  value: AcceptedUpload | UploadRefusal | Uint8Array,
): value is UploadRefusal {
  return "status" in value && "message" in value;
}

/**
 * Steps 3 to 5 of the upload route, in order: cap the body, validate the
 * fields, identify the images. Answers the accepted upload or the first
 * refusal.
 */
export async function readUpload(
  request: Request,
  assetId: string,
): Promise<AcceptedUpload | UploadRefusal> {
  const body = await readCappedBody(request, assetId);
  if (isUploadRefusal(body)) {
    return body;
  }
  const form = await parseMultipart(body, request.headers.get("content-type"));
  if (form === null) {
    return INVALID_UPLOAD;
  }
  const parsed = photoUploadFormSchema.safeParse(formInput(assetId, form));
  if (!parsed.success) {
    return INVALID_UPLOAD;
  }
  return inspectUpload(parsed.data);
}
