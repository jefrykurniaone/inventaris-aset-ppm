import { beforeEach, describe, expect, it, vi } from "vitest";

import { MAX_PHOTO_BYTES, MAX_UPLOAD_BODY_BYTES } from "@/lib/photo-upload";
import { getSessionUser } from "@/lib/require-user";
import { getPhotoStorage } from "@/lib/storage";
import {
  createInMemoryPhotoStorage,
  type InMemoryPhotoStorage,
} from "@/lib/storage-fake";

import { POST } from "./route";

/**
 * `POST /api/assets/<id>/photos`, called with real `Request` objects. The
 * photo storage is the in-memory fake, and the database is a stand-in
 * transaction client, so the real `insertPhoto` runs: what is asserted is the
 * response a browser gets and the row and content that exist afterwards.
 */

const tx = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  assetPhoto: { count: vi.fn(), create: vi.fn() },
  assetActivity: { create: vi.fn() },
}));

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) =>
      callback(tx),
    ),
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => (key: string) => key),
}));
vi.mock("@/lib/require-user", () => ({ getSessionUser: vi.fn() }));
vi.mock("@/lib/storage", () => ({ getPhotoStorage: vi.fn() }));

const mockedGetSessionUser = vi.mocked(getSessionUser);

const APP_HOST = "localhost:3000";
const APP_ORIGIN = `http://${APP_HOST}`;
const ASSET_ID = "0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b";
const PHOTO_ID = "0199a1b2-ffff-7e5f-8a9b-0c1d2e3f4a5b";
const ACTOR_ID = "user-1";
const UPLOAD_URL = `${APP_ORIGIN}/api/assets/${ASSET_ID}/photos`;
const CHUNK_BYTES = 64 * 1024;

const JPEG_BYTES = Uint8Array.of(0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4);
const THUMB_BYTES = Uint8Array.of(0xff, 0xd8, 0xff, 0xdb, 9);
const TEXT_BYTES = new TextEncoder().encode("not an image at all");

let storage: InMemoryPhotoStorage;

function image(
  bytes: Uint8Array<ArrayBuffer>,
  type: string,
  name = "photo.jpg",
): File {
  return new File([bytes], name, { type });
}

interface UploadParts {
  readonly full?: File;
  readonly thumbnail?: File;
  readonly width?: string;
}

function uploadRequest(
  parts: UploadParts = {},
  headers: Record<string, string> = {},
): Request {
  const body = new FormData();
  body.append("full", parts.full ?? image(JPEG_BYTES, "image/jpeg"));
  body.append("thumbnail", parts.thumbnail ?? image(THUMB_BYTES, "image/jpeg"));
  body.append("width", parts.width ?? "1600");
  body.append("height", "1200");
  return new Request(UPLOAD_URL, {
    method: "POST",
    headers: { host: APP_HOST, origin: APP_ORIGIN, ...headers },
    body,
  });
}

/** A request whose body is endless and counts every chunk read from it, so a
 * test can prove a refusal came before the body was read. */
function streamedRequest(headers: Record<string, string> = {}) {
  const probe = { pulls: 0 };
  const stream = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        probe.pulls += 1;
        controller.enqueue(new Uint8Array(CHUNK_BYTES));
      },
    },
    { highWaterMark: 0 },
  );
  const init: RequestInit & { duplex: "half" } = {
    method: "POST",
    headers: { host: APP_HOST, origin: APP_ORIGIN, ...headers },
    body: stream,
    duplex: "half",
  };
  return { request: new Request(UPLOAD_URL, init), probe };
}

async function send(request: Request) {
  const response = await POST(request, {
    params: Promise.resolve({ id: ASSET_ID }),
  });
  return { status: response.status, body: await response.json() };
}

beforeEach(() => {
  vi.clearAllMocks();
  storage = createInMemoryPhotoStorage();
  vi.mocked(getPhotoStorage).mockReturnValue(storage);
  mockedGetSessionUser.mockResolvedValue({ id: ACTOR_ID } as Awaited<
    ReturnType<typeof getSessionUser>
  >);
  tx.$queryRaw.mockResolvedValue([{ id: ASSET_ID }]);
  tx.assetPhoto.count.mockResolvedValue(0);
  tx.assetPhoto.create.mockResolvedValue({ id: PHOTO_ID });
  tx.assetActivity.create.mockResolvedValue({});
});

function expectNothingStored(): void {
  expect(tx.assetPhoto.create).not.toHaveBeenCalled();
  expect(storage.storedPhotoIds()).toEqual([]);
}

describe("the request boundary", () => {
  it("refuses an unauthenticated upload without reading its body", async () => {
    mockedGetSessionUser.mockResolvedValue(null);
    const { request, probe } = streamedRequest();

    const { status, body } = await send(request);

    expect(status).toBe(401);
    expect(body).toEqual({ ok: false, message: "invalidRequest" });
    expect(probe.pulls).toBe(0);
    expectNothingStored();
  });

  it("answers 403 to a foreign Origin, without reading the body", async () => {
    const { request, probe } = streamedRequest({
      origin: "https://evil.example",
    });

    const { status, body } = await send(request);

    expect(status).toBe(403);
    expect(body).toEqual({ ok: false, message: "invalidRequest" });
    expect(probe.pulls).toBe(0);
    expectNothingStored();
  });

  it("answers 413 to a declared oversize body before reading a byte of it", async () => {
    const { request, probe } = streamedRequest({
      "content-length": String(MAX_UPLOAD_BODY_BYTES + 1),
    });

    const { status, body } = await send(request);

    expect(status).toBe(413);
    expect(body).toEqual({ ok: false, message: "tooLarge" });
    expect(probe.pulls).toBe(0);
  });

  it("answers 413 to an undeclared oversize body, and stops reading at the cap", async () => {
    const { request, probe } = streamedRequest();

    const { status } = await send(request);

    expect(status).toBe(413);
    expect(probe.pulls).toBe(
      Math.floor(MAX_UPLOAD_BODY_BYTES / CHUNK_BYTES) + 1,
    );
    expectNothingStored();
  });

  it("answers 400 to fields that do not validate", async () => {
    const { status, body } = await send(uploadRequest({ width: "wide" }));

    expect(status).toBe(400);
    expect(body).toEqual({ ok: false, message: "invalidRequest" });
    expectNothingStored();
  });
});

describe("identifying the images", () => {
  it("refuses non-image bytes declared as image/webp with the unsupported-format message", async () => {
    const disguised = image(TEXT_BYTES, "image/webp", "x.webp");

    const { status, body } = await send(uploadRequest({ full: disguised }));

    expect(status).toBe(415);
    expect(body).toEqual({ ok: false, message: "unsupportedFormat" });
    expectNothingStored();
  });

  it("refuses a part whose declared type disagrees with its bytes", async () => {
    const mislabelled = image(THUMB_BYTES, "image/png");

    const { status, body } = await send(
      uploadRequest({ thumbnail: mislabelled }),
    );

    expect(status).toBe(415);
    expect(body).toEqual({ ok: false, message: "unsupportedFormat" });
    expectNothingStored();
  });

  it("refuses an empty part as an incomplete upload", async () => {
    const { status, body } = await send(
      uploadRequest({ thumbnail: image(new Uint8Array(0), "image/jpeg") }),
    );

    expect(status).toBe(400);
    expect(body).toEqual({ ok: false, message: "uploadIncomplete" });
  });

  it("refuses a part over the per-photo ceiling as too large", async () => {
    const huge = new Uint8Array(MAX_PHOTO_BYTES + 1);
    huge.set(JPEG_BYTES);

    const { status, body } = await send(
      uploadRequest({ full: image(huge, "image/jpeg") }),
    );

    expect(status).toBe(413);
    expect(body).toEqual({ ok: false, message: "tooLarge" });
    expectNothingStored();
  });
});

describe("storing the photo", () => {
  it("creates the row and its content in one transaction", async () => {
    const { status, body } = await send(uploadRequest());

    expect(status).toBe(201);
    expect(body).toEqual({ ok: true, value: { photoId: PHOTO_ID } });
    expect(tx.assetPhoto.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          assetId: ASSET_ID,
          uploadedById: ACTOR_ID,
          width: 1600,
          height: 1200,
          sizeBytes: JPEG_BYTES.length,
          isPrimary: true,
        }),
      }),
    );
    expect(storage.contentOf(PHOTO_ID)).toEqual({
      fullBytes: JPEG_BYTES,
      fullContentType: "image/jpeg",
      thumbBytes: THUMB_BYTES,
      thumbContentType: "image/jpeg",
    });
    expect(storage.writeTransactions).toEqual([tx]);
    expect(tx.assetActivity.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "photo_added",
        payload: { photoId: PHOTO_ID },
      }),
    });
  });

  it("refuses a sixth photo", async () => {
    tx.assetPhoto.count.mockResolvedValue(5);

    const { status, body } = await send(uploadRequest());

    expect(status).toBe(409);
    expect(body).toEqual({ ok: false, message: "limitReached" });
    expectNothingStored();
  });

  it("answers 404 when the asset is missing or withdrawn", async () => {
    tx.$queryRaw.mockResolvedValue([]);

    const { status, body } = await send(uploadRequest());

    expect(status).toBe(404);
    expect(body).toEqual({ ok: false, message: "assetNotFound" });
    expectNothingStored();
  });

  it("answers a database failure with a localised message, never its text", async () => {
    tx.assetPhoto.create.mockRejectedValue(new Error("connection reset"));
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const { status, body } = await send(uploadRequest());

    expect(status).toBe(500);
    expect(body).toEqual({ ok: false, message: "storageUnavailable" });
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining("connection reset"),
    );
    consoleError.mockRestore();
  });
});
