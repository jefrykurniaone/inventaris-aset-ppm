import type {
  ObjectStorage,
  SignedUploadTarget,
  StoredObject,
} from "@/lib/storage";

/**
 * An in-memory `ObjectStorage`.
 *
 * This is the reason the seam in `src/lib/storage.ts` is an interface at all
 * (ADR 0005): not to switch implementations by environment, but so that the
 * server actions and the mutations around photos can be tested without a
 * network call and without a Supabase project. There is no second production
 * implementation and there is never going to be one.
 *
 * It lives beside the interface rather than in a test file because more than
 * one test module needs it, and a fake that drifts from the interface it
 * fakes is worse than no fake at all — keeping it here means `tsc` checks the
 * two against each other.
 */

const FAKE_ORIGIN = "https://storage.test.invalid";

/** Code-unit order, stated explicitly. `toSorted()` with no comparator is
 * SonarQube S2871, and `localeCompare` would make an assertion depend on the
 * ICU data of whatever machine ran the test. */
function byPath(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

export interface InMemoryObjectStorage extends ObjectStorage {
  /** Simulates the browser's upload having landed. The real upload is a PUT
   * from the browser to a signed URL, so nothing on the server side ever
   * writes bytes; a test that wants an object present has to say so. */
  putObject(objectPath: string, object: StoredObject): void;
  /** Every path currently held, sorted, so an assertion does not depend on
   * insertion order. */
  storedPaths(): readonly string[];
  /** The paths `createSignedUploadTarget` has been asked for, in order. */
  readonly signedPaths: readonly string[];
}

export function createInMemoryObjectStorage(): InMemoryObjectStorage {
  const objects = new Map<string, StoredObject>();
  const signedPaths: string[] = [];

  function createSignedUploadTarget(
    objectPath: string,
  ): Promise<SignedUploadTarget> {
    signedPaths.push(objectPath);
    return Promise.resolve({
      objectPath,
      signedUrl: `${FAKE_ORIGIN}/upload/${objectPath}`,
    });
  }

  function getPublicUrl(objectPath: string): string {
    return `${FAKE_ORIGIN}/public/${objectPath}`;
  }

  function statObject(objectPath: string): Promise<StoredObject | null> {
    return Promise.resolve(objects.get(objectPath) ?? null);
  }

  function listObjectPaths(prefix: string): Promise<readonly string[]> {
    const matching = [...objects.keys()].filter((path) =>
      path.startsWith(prefix),
    );
    return Promise.resolve(matching.toSorted(byPath));
  }

  function deleteObjects(objectPaths: readonly string[]): Promise<void> {
    for (const objectPath of objectPaths) {
      objects.delete(objectPath);
    }
    return Promise.resolve();
  }

  return {
    createSignedUploadTarget,
    getPublicUrl,
    statObject,
    listObjectPaths,
    deleteObjects,
    putObject(objectPath, object) {
      objects.set(objectPath, object);
    },
    storedPaths() {
      return [...objects.keys()].toSorted(byPath);
    },
    signedPaths,
  };
}
