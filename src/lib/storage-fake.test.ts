import { describe, expect, it } from "vitest";

import type { PhotoContent, TransactionClient } from "./storage";
import { createInMemoryPhotoStorage } from "./storage-fake";

const PHOTO_ID = "photo-1";
const OTHER_PHOTO_ID = "photo-0";
const TX = { marker: "transaction" } as unknown as TransactionClient;

const CONTENT: PhotoContent = {
  fullBytes: Uint8Array.of(0xff, 0xd8, 0xff, 1),
  fullContentType: "image/jpeg",
  thumbBytes: Uint8Array.of(0xff, 0xd8, 0xff, 2),
  thumbContentType: "image/jpeg",
};

describe("the in-memory photo storage", () => {
  it("holds nothing until content is written, matching the real seam", async () => {
    const storage = createInMemoryPhotoStorage();

    await expect(
      storage.readPhotoVariant(PHOTO_ID, "full"),
    ).resolves.toBeNull();
    expect(storage.storedPhotoIds()).toEqual([]);
  });

  it("returns each variant's own bytes and type once written", async () => {
    const storage = createInMemoryPhotoStorage();
    await storage.writePhotoContent(TX, PHOTO_ID, CONTENT);

    await expect(storage.readPhotoVariant(PHOTO_ID, "full")).resolves.toEqual({
      bytes: CONTENT.fullBytes,
      contentType: "image/jpeg",
    });
    await expect(storage.readPhotoVariant(PHOTO_ID, "thumb")).resolves.toEqual({
      bytes: CONTENT.thumbBytes,
      contentType: "image/jpeg",
    });
  });

  it("records the transaction each write was handed", async () => {
    const storage = createInMemoryPhotoStorage();
    await storage.writePhotoContent(TX, PHOTO_ID, CONTENT);

    expect(storage.writeTransactions).toEqual([TX]);
    expect(storage.contentOf(PHOTO_ID)).toBe(CONTENT);
  });

  it("answers null for a withdrawn asset's photo, as the real query does", async () => {
    const storage = createInMemoryPhotoStorage();
    await storage.writePhotoContent(TX, PHOTO_ID, CONTENT);

    storage.withdraw(PHOTO_ID);
    storage.withdraw("never-written");

    await expect(
      storage.readPhotoVariant(PHOTO_ID, "thumb"),
    ).resolves.toBeNull();
    expect(storage.storedPhotoIds()).toEqual([PHOTO_ID]);
  });

  it("forgets a photo's content when its row is removed, like the cascade", async () => {
    const storage = createInMemoryPhotoStorage();
    await storage.writePhotoContent(TX, PHOTO_ID, CONTENT);

    storage.removePhoto(PHOTO_ID);

    await expect(
      storage.readPhotoVariant(PHOTO_ID, "full"),
    ).resolves.toBeNull();
    expect(storage.contentOf(PHOTO_ID)).toBeUndefined();
  });

  it("sorts stored ids, so an assertion does not depend on insertion order", async () => {
    const storage = createInMemoryPhotoStorage();
    await storage.writePhotoContent(TX, PHOTO_ID, CONTENT);
    await storage.writePhotoContent(TX, OTHER_PHOTO_ID, CONTENT);

    expect(storage.storedPhotoIds()).toEqual([OTHER_PHOTO_ID, PHOTO_ID]);
  });
});
