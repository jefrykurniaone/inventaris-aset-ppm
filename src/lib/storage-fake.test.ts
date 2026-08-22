import { describe, expect, it } from "vitest";

import { createInMemoryObjectStorage } from "./storage-fake";

const FULL_PATH = "assets/asset-1/aaaaaaaaaaaaaaaa.webp";
const THUMB_PATH = "assets/asset-1/bbbbbbbbbbbbbbbb.webp";
const OTHER_ASSET_PATH = "assets/asset-2/cccccccccccccccc.webp";
const STORED = { contentType: "image/webp", sizeBytes: 1_024 };

describe("the in-memory object storage", () => {
  it("holds nothing until an upload is simulated, matching the real seam", async () => {
    const storage = createInMemoryObjectStorage();

    await storage.createSignedUploadTarget(FULL_PATH);

    expect(storage.signedPaths).toEqual([FULL_PATH]);
    await expect(storage.statObject(FULL_PATH)).resolves.toBeNull();
  });

  it("reports a simulated upload once it has landed", async () => {
    const storage = createInMemoryObjectStorage();
    storage.putObject(FULL_PATH, STORED);

    await expect(storage.statObject(FULL_PATH)).resolves.toEqual(STORED);
  });

  it("builds a distinct public URL per object path", () => {
    const storage = createInMemoryObjectStorage();

    expect(storage.getPublicUrl(FULL_PATH)).toContain(FULL_PATH);
    expect(storage.getPublicUrl(FULL_PATH)).not.toBe(
      storage.getPublicUrl(THUMB_PATH),
    );
  });

  it("lists only the paths under the prefix it is asked for", async () => {
    const storage = createInMemoryObjectStorage();
    storage.putObject(FULL_PATH, STORED);
    storage.putObject(THUMB_PATH, STORED);
    storage.putObject(OTHER_ASSET_PATH, STORED);

    await expect(storage.listObjectPaths("assets/asset-1/")).resolves.toEqual([
      FULL_PATH,
      THUMB_PATH,
    ]);
    await expect(storage.listObjectPaths("")).resolves.toHaveLength(3);
  });

  it("deletes the paths it is given and tolerates one that is already gone", async () => {
    const storage = createInMemoryObjectStorage();
    storage.putObject(FULL_PATH, STORED);

    await storage.deleteObjects([FULL_PATH, THUMB_PATH]);

    expect(storage.storedPaths()).toEqual([]);
  });

  it("sorts stored paths, so an assertion does not depend on insertion order", () => {
    const storage = createInMemoryObjectStorage();
    storage.putObject(THUMB_PATH, STORED);
    storage.putObject(FULL_PATH, STORED);

    expect(storage.storedPaths()).toEqual([FULL_PATH, THUMB_PATH]);
  });
});
