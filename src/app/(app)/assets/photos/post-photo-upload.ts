import { photoUploadResponseSchema, type PhotoUploadResponse } from "./schemas";

/**
 * The browser half of a photo upload (ADR 0009): one multipart `POST` to the
 * application's own upload route, and nothing else.
 *
 * `XMLHttpRequest` rather than `fetch`, for the two things the upload control
 * promises: `fetch` reports no upload progress at all, and a phone on mobile
 * data sending a few hundred kilobytes needs a progress bar and a cancel
 * button. Abort goes through an `AbortSignal`, so the caller cancels the same
 * way it cancels compression.
 *
 * The body is a `FormData`, so the browser writes the multipart boundary and
 * the `Content-Length` itself; no `Content-Type` is set here. The request is
 * same-origin, so the session cookie goes with it and the browser adds the
 * `Origin` header the route checks.
 */

/** Thrown when the upload was cancelled by the caller. Distinguished from a
 * failure so the interface can stay quiet instead of showing an error for
 * something the user asked for. */
export class UploadCancelledError extends Error {
  constructor() {
    super("The upload was cancelled.");
    this.name = "UploadCancelledError";
  }
}

/** Thrown when the network gave out, or the answer was not the route's JSON
 * (a proxy's error page, a truncated body). The status is carried for the
 * log; it is never rendered. */
export class UploadFailedError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`The upload failed with status ${status}.`);
    this.name = "UploadFailedError";
    this.status = status;
  }
}

export interface PostPhotoUploadInput {
  readonly url: string;
  readonly body: FormData;
  readonly signal?: AbortSignal;
  /** Fraction of the request body sent, 0 to 1. Only called while the length
   * is computable. */
  readonly onProgress?: (fraction: number) => void;
  /** Called once the whole body has been sent and the server is working. */
  readonly onSent?: () => void;
}

/** The route's JSON answer, or `null` when the body is not that shape. A
 * refusal with a 4xx status is still a valid answer: it carries the localised
 * message the user should see. */
function readResponse(request: XMLHttpRequest): PhotoUploadResponse | null {
  let body: unknown;
  try {
    body = JSON.parse(request.responseText);
  } catch {
    // Not JSON at all — e.g. an HTML error page from something in between.
    // The caller turns `null` into `UploadFailedError`, which is logged.
    return null;
  }
  const parsed = photoUploadResponseSchema.safeParse(body);
  return parsed.success ? parsed.data : null;
}

function listen(
  request: XMLHttpRequest,
  input: PostPhotoUploadInput,
  resolve: (response: PhotoUploadResponse) => void,
  reject: (error: Error) => void,
): void {
  const { onProgress, onSent } = input;
  if (onProgress) {
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress(event.loaded / event.total);
      }
    });
  }
  if (onSent) {
    request.upload.addEventListener("load", onSent);
  }
  request.addEventListener("load", () => {
    const response = readResponse(request);
    if (response === null) {
      reject(new UploadFailedError(request.status));
      return;
    }
    resolve(response);
  });
  request.addEventListener("error", () => reject(new UploadFailedError(0)));
  request.addEventListener("abort", () => reject(new UploadCancelledError()));
}

/** Sends one upload. Resolves with the route's answer — success or a
 * localised refusal — and rejects with `UploadCancelledError` or
 * `UploadFailedError` otherwise. */
export function postPhotoUpload(
  input: PostPhotoUploadInput,
): Promise<PhotoUploadResponse> {
  return new Promise((resolve, reject) => {
    if (input.signal?.aborted) {
      reject(new UploadCancelledError());
      return;
    }
    const request = new XMLHttpRequest();
    request.open("POST", input.url, true);
    listen(request, input, resolve, reject);
    input.signal?.addEventListener("abort", () => request.abort(), {
      once: true,
    });
    request.send(input.body);
  });
}
