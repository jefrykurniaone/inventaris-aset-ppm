import { createClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  assertDevelopmentStorageBucket,
  DEPLOYMENT_STORAGE_BUCKET,
  DEVELOPMENT_STORAGE_BUCKET,
  getObjectStorage,
  getStorageBucket,
  StorageConfigurationError,
  StorageOperationError,
} from "./storage";

/**
 * The seam is exercised against a stubbed `@supabase/supabase-js` rather than
 * against the network: what is worth asserting here is the mapping — which
 * bucket is addressed, what a Supabase `{ data, error }` pair becomes, and
 * that the recursive listing walks folders — none of which a live call would
 * demonstrate more clearly. The live path is proven separately and for real by
 * `scripts/verify-photo-storage.ts`, which runs against `asset-photos-dev`.
 */

const bucketApi = {
  createSignedUploadUrl: vi.fn(),
  getPublicUrl: vi.fn(),
  info: vi.fn(),
  list: vi.fn(),
  remove: vi.fn(),
};

const from = vi.fn(() => bucketApi);

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ storage: { from } })),
}));

const mockedCreateClient = vi.mocked(createClient);

const PROJECT_URL = "https://project.supabase.test";
const SERVICE_ROLE_KEY = "service-role-key-placeholder";
const OBJECT_PATH = "assets/asset-1/abcdefghijklmnop.webp";
const LIST_PAGE_SIZE = 100;

function storageError(message: string) {
  return { data: null, error: { message } };
}

function folderEntry(name: string) {
  return { name, id: null };
}

function fileEntry(name: string) {
  return { name, id: `id-${name}` };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SUPABASE_URL = PROJECT_URL;
  process.env.SUPABASE_SERVICE_ROLE_KEY = SERVICE_ROLE_KEY;
  process.env.SUPABASE_STORAGE_BUCKET = DEVELOPMENT_STORAGE_BUCKET;
});

afterEach(() => {
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_STORAGE_BUCKET;
});

describe("configuration", () => {
  it("reads the bucket from the environment", () => {
    expect(getStorageBucket()).toBe(DEVELOPMENT_STORAGE_BUCKET);
  });

  it.each([
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_STORAGE_BUCKET",
  ])("names %s when it is missing, and never a value", async (variable) => {
    delete process.env[variable];

    await expect(
      getObjectStorage().createSignedUploadTarget(OBJECT_PATH),
    ).rejects.toBeInstanceOf(StorageConfigurationError);
  });

  it("addresses the bucket the environment names, with no branch of its own", () => {
    process.env.SUPABASE_STORAGE_BUCKET = DEPLOYMENT_STORAGE_BUCKET;
    bucketApi.getPublicUrl.mockReturnValue({
      data: { publicUrl: `${PROJECT_URL}/x` },
    });

    getObjectStorage().getPublicUrl(OBJECT_PATH);

    expect(from).toHaveBeenCalledWith(DEPLOYMENT_STORAGE_BUCKET);
  });

  it("builds a client that keeps no session, because there is no user to keep", () => {
    bucketApi.getPublicUrl.mockReturnValue({
      data: { publicUrl: `${PROJECT_URL}/x` },
    });

    getObjectStorage().getPublicUrl(OBJECT_PATH);

    expect(mockedCreateClient).toHaveBeenCalledWith(
      PROJECT_URL,
      SERVICE_ROLE_KEY,
      expect.objectContaining({
        auth: expect.objectContaining({ persistSession: false }),
      }),
    );
  });
});

describe("assertDevelopmentStorageBucket", () => {
  it("allows the development bucket", () => {
    expect(() =>
      assertDevelopmentStorageBucket(DEVELOPMENT_STORAGE_BUCKET),
    ).not.toThrow();
  });

  it.each([DEPLOYMENT_STORAGE_BUCKET, "", "asset-photos-staging"])(
    "refuses %s and names the bucket it refused",
    (bucket) => {
      expect(() => assertDevelopmentStorageBucket(bucket)).toThrow(
        DEVELOPMENT_STORAGE_BUCKET,
      );
    },
  );
});

describe("createSignedUploadTarget", () => {
  it("returns the signed URL alongside the path it was minted for", async () => {
    bucketApi.createSignedUploadUrl.mockResolvedValue({
      data: {
        signedUrl: `${PROJECT_URL}/upload?token=t`,
        token: "t",
        path: OBJECT_PATH,
      },
      error: null,
    });

    const target =
      await getObjectStorage().createSignedUploadTarget(OBJECT_PATH);

    expect(target).toEqual({
      objectPath: OBJECT_PATH,
      signedUrl: `${PROJECT_URL}/upload?token=t`,
    });
    expect(bucketApi.createSignedUploadUrl).toHaveBeenCalledWith(OBJECT_PATH);
  });

  it("raises a StorageOperationError naming the operation and the path", async () => {
    bucketApi.createSignedUploadUrl.mockResolvedValue(
      storageError("bucket not found"),
    );

    await expect(
      getObjectStorage().createSignedUploadTarget(OBJECT_PATH),
    ).rejects.toThrow(StorageOperationError);
  });

  it("raises rather than returning an empty target when no data comes back", async () => {
    bucketApi.createSignedUploadUrl.mockResolvedValue({
      data: null,
      error: null,
    });

    await expect(
      getObjectStorage().createSignedUploadTarget(OBJECT_PATH),
    ).rejects.toThrow("no signed URL was returned");
  });
});

describe("getPublicUrl", () => {
  it("builds the URL from the configured bucket at read time (FR-4.9)", () => {
    const publicUrl = `${PROJECT_URL}/storage/v1/object/public/${DEVELOPMENT_STORAGE_BUCKET}/${OBJECT_PATH}`;
    bucketApi.getPublicUrl.mockReturnValue({ data: { publicUrl } });

    expect(getObjectStorage().getPublicUrl(OBJECT_PATH)).toBe(publicUrl);
  });
});

describe("statObject", () => {
  it("reports what the bucket holds, not what a caller claimed", async () => {
    bucketApi.info.mockResolvedValue({
      data: { contentType: "image/webp", size: 123_456 },
      error: null,
    });

    await expect(getObjectStorage().statObject(OBJECT_PATH)).resolves.toEqual({
      contentType: "image/webp",
      sizeBytes: 123_456,
    });
  });

  it("returns null for an object that is not there", async () => {
    bucketApi.info.mockResolvedValue(storageError("Object not found"));

    await expect(
      getObjectStorage().statObject(OBJECT_PATH),
    ).resolves.toBeNull();
  });

  it("reports an unknown type as empty and an unknown size as zero, so neither passes a check by omission", async () => {
    bucketApi.info.mockResolvedValue({ data: { id: "x" }, error: null });

    await expect(getObjectStorage().statObject(OBJECT_PATH)).resolves.toEqual({
      contentType: "",
      sizeBytes: 0,
    });
  });
});

describe("listObjectPaths", () => {
  it("walks folders so a nested object is reached", async () => {
    bucketApi.list
      .mockResolvedValueOnce({ data: [folderEntry("assets")], error: null })
      .mockResolvedValueOnce({ data: [folderEntry("asset-1")], error: null })
      .mockResolvedValueOnce({
        data: [fileEntry("a.webp"), fileEntry("b.webp")],
        error: null,
      });

    await expect(getObjectStorage().listObjectPaths("")).resolves.toEqual([
      "assets/asset-1/a.webp",
      "assets/asset-1/b.webp",
    ]);
  });

  it("pages until a short page comes back", async () => {
    const firstPage = Array.from({ length: LIST_PAGE_SIZE }, (_, index) =>
      fileEntry(`file-${index}.webp`),
    );
    bucketApi.list
      .mockResolvedValueOnce({ data: firstPage, error: null })
      .mockResolvedValueOnce({ data: [fileEntry("last.webp")], error: null });

    const paths = await getObjectStorage().listObjectPaths("assets/asset-1");

    expect(paths).toHaveLength(LIST_PAGE_SIZE + 1);
    expect(bucketApi.list).toHaveBeenCalledWith("assets/asset-1", {
      limit: LIST_PAGE_SIZE,
      offset: LIST_PAGE_SIZE,
    });
  });

  it("raises rather than reporting an empty bucket when the listing fails", async () => {
    bucketApi.list.mockResolvedValue(storageError("permission denied"));

    await expect(getObjectStorage().listObjectPaths("")).rejects.toThrow(
      StorageOperationError,
    );
  });
});

describe("deleteObjects", () => {
  it("removes the paths it is given", async () => {
    bucketApi.remove.mockResolvedValue({ data: [], error: null });

    await getObjectStorage().deleteObjects([OBJECT_PATH]);

    expect(bucketApi.remove).toHaveBeenCalledWith([OBJECT_PATH]);
  });

  it("does not call storage at all for an empty list", async () => {
    await getObjectStorage().deleteObjects([]);

    expect(bucketApi.remove).not.toHaveBeenCalled();
  });

  it("raises when the delete is refused, so a caller cannot orphan an object silently", async () => {
    bucketApi.remove.mockResolvedValue({
      data: null,
      error: { message: "no" },
    });

    await expect(
      getObjectStorage().deleteObjects([OBJECT_PATH]),
    ).rejects.toThrow(StorageOperationError);
  });
});
