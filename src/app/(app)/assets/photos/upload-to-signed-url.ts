/**
 * The browser half of the direct upload (PRD FR-4.4, risk R2).
 *
 * A `PUT` to a URL the server minted, and nothing else. **No Supabase client
 * is imported here**, and that is deliberate: `src/lib/storage.ts` is the only
 * module allowed one (`CLAUDE.md`), and it is a server module holding the
 * service-role key, so it must never reach the browser bundle. What crosses
 * the boundary is an opaque URL string; this file knows nothing about buckets,
 * projects or tokens.
 *
 * `XMLHttpRequest` rather than `fetch`, and rather than the library's
 * `uploadToSignedUrl`, for one reason each and both required by the ticket:
 * `fetch` reports no upload progress at all, and `uploadToSignedUrl` accepts
 * neither a progress callback nor an `AbortSignal`. A phone on mobile data
 * uploading 400 KB needs a progress bar and a cancel button, so the transport
 * has to be the one that can provide them.
 */

const HTTP_OK_MIN = 200;
const HTTP_OK_MAX = 299;

/** Object names are `nanoid`s and their contents never change, so the stored
 * object is immutable and may be cached for a year. This is mitigation 4 of
 * PRD risk R2: every scan that re-reads a photo from the CDN rather than from
 * storage costs no egress. */
const IMMUTABLE_CACHE_CONTROL = "max-age=31536000, immutable";

/** Thrown when the upload was cancelled by the caller. Distinguished from a
 * failure so the interface can stay quiet instead of showing an error for
 * something the user asked for. */
export class UploadCancelledError extends Error {
  constructor() {
    super("The upload was cancelled.");
    this.name = "UploadCancelledError";
  }
}

/** Thrown when storage refused or the network gave out. The status is carried
 * for the log; it is never rendered. */
export class UploadFailedError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`The upload failed with status ${status}.`);
    this.name = "UploadFailedError";
    this.status = status;
  }
}

export interface SignedUploadInput {
  readonly signedUrl: string;
  readonly body: Blob;
  readonly contentType: string;
  readonly signal?: AbortSignal;
  /** Fraction uploaded, 0 to 1. Only called while the length is computable. */
  readonly onProgress?: (fraction: number) => void;
}

function settleOnLoad(
  request: XMLHttpRequest,
  resolve: () => void,
  reject: (error: Error) => void,
): void {
  const { status } = request;
  if (status >= HTTP_OK_MIN && status <= HTTP_OK_MAX) {
    resolve();
    return;
  }
  reject(new UploadFailedError(status));
}

function trackProgress(
  request: XMLHttpRequest,
  onProgress: (fraction: number) => void,
): void {
  request.upload.addEventListener("progress", (event) => {
    if (event.lengthComputable && event.total > 0) {
      onProgress(event.loaded / event.total);
    }
  });
}

/** Uploads one object. Resolves on success, rejects with
 * `UploadCancelledError` or `UploadFailedError` otherwise. */
export function uploadToSignedUrl({
  signedUrl,
  body,
  contentType,
  signal,
  onProgress,
}: SignedUploadInput): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", signedUrl, true);
    request.setRequestHeader("content-type", contentType);
    request.setRequestHeader("cache-control", IMMUTABLE_CACHE_CONTROL);

    if (onProgress) {
      trackProgress(request, onProgress);
    }
    request.addEventListener("load", () =>
      settleOnLoad(request, resolve, reject),
    );
    request.addEventListener("error", () => reject(new UploadFailedError(0)));
    request.addEventListener("abort", () => reject(new UploadCancelledError()));
    signal?.addEventListener("abort", () => request.abort(), { once: true });

    if (signal?.aborted) {
      reject(new UploadCancelledError());
      return;
    }
    request.send(body);
  });
}
