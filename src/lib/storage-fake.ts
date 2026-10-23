import type { PhotoVariant } from "@/lib/photo-address";
import type {
  PhotoContent,
  PhotoStorage,
  StoredPhotoVariant,
  TransactionClient,
} from "@/lib/storage";

/**
 * An in-memory `PhotoStorage`.
 *
 * This is the reason the seam in `src/lib/storage.ts` is an interface at all
 * (ADR 0009): not to switch implementations by environment, but so that the
 * upload and serving routes can be tested with real `Request` objects and no
 * database. There is no second production implementation.
 *
 * It lives beside the interface rather than in a test file because more than
 * one test module needs it, and a fake that drifts from the interface it
 * fakes is worse than no fake at all — keeping it here means `tsc` checks the
 * two against each other. It imports only types from the real seam, so
 * loading it never loads the database client.
 *
 * The real `readPhotoVariant` answers `null` for a withdrawn asset's photo, so
 * the fake has to be told which photos those are: `withdraw` stands in for
 * setting `deletedAt` on the asset, and `removePhoto` for the cascade that
 * deleting a photo row triggers.
 */

/** Code-unit order, stated explicitly. `toSorted()` with no comparator is
 * SonarQube S2871, and `localeCompare` would make an assertion depend on the
 * ICU data of whatever machine ran the test. */
function byId(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

interface StoredEntry {
  readonly content: PhotoContent;
  readonly isWithdrawn: boolean;
}

export interface InMemoryPhotoStorage extends PhotoStorage {
  /** Simulates withdrawing the asset the photo belongs to. */
  withdraw(photoId: string): void;
  /** Simulates the cascade from deleting the photo row. */
  removePhoto(photoId: string): void;
  /** What was written for one photo, or `undefined`. */
  contentOf(photoId: string): PhotoContent | undefined;
  /** Every photo id holding content, sorted, so an assertion does not depend
   * on insertion order. */
  storedPhotoIds(): readonly string[];
  /** The transaction client each write was handed, in order — so a test can
   * prove the bytes were written inside the caller's transaction. */
  readonly writeTransactions: readonly TransactionClient[];
}

function toVariant(
  content: PhotoContent,
  variant: PhotoVariant,
): StoredPhotoVariant {
  return variant === "full"
    ? { bytes: content.fullBytes, contentType: content.fullContentType }
    : { bytes: content.thumbBytes, contentType: content.thumbContentType };
}

export function createInMemoryPhotoStorage(): InMemoryPhotoStorage {
  const entries = new Map<string, StoredEntry>();
  const writeTransactions: TransactionClient[] = [];

  return {
    writePhotoContent(tx, photoId, content) {
      writeTransactions.push(tx);
      entries.set(photoId, { content, isWithdrawn: false });
      return Promise.resolve();
    },
    readPhotoVariant(photoId, variant) {
      const entry = entries.get(photoId);
      if (!entry || entry.isWithdrawn) {
        return Promise.resolve(null);
      }
      return Promise.resolve(toVariant(entry.content, variant));
    },
    withdraw(photoId) {
      const entry = entries.get(photoId);
      if (entry) {
        entries.set(photoId, { ...entry, isWithdrawn: true });
      }
    },
    removePhoto(photoId) {
      entries.delete(photoId);
    },
    contentOf(photoId) {
      return entries.get(photoId)?.content;
    },
    storedPhotoIds() {
      return [...entries.keys()].toSorted(byId);
    },
    writeTransactions,
  };
}
