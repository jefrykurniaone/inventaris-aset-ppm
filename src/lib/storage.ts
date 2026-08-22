import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * The object-storage seam (PRD FR-4.5, ADR 0005).
 *
 * **This is the only module in the repository that may import a Supabase
 * client.** `CLAUDE.md` and issue #21 both state it, and the pull request for
 * issue #9 quotes the grep that proves it.
 *
 * One interface, **one** implementation: Supabase Storage, in every
 * environment. The interface is not an environment switch — there is no
 * `STORAGE_DRIVER`, no local-filesystem driver, and no `if (isDevelopment)`.
 * It exists for two reasons and no others: so that this file stays the single
 * place object storage is touched, and so that a test can inject the in-memory
 * fake in `src/lib/storage-fake.ts` instead of reaching the network.
 *
 * Every method maps to a requirement rather than to a convenience:
 *
 * - `createSignedUploadTarget` — FR-4.4, the browser uploads straight to
 *   storage so that image bytes never pass through a serverless function.
 * - `getPublicUrl` — FR-4.9, the database stores an object path and the URL is
 *   built at render time, so changing bucket or project needs no data change.
 * - `statObject` — FR-4.6. The size and content-type ceiling is a *security*
 *   control, and a control that reads the client's own claim about a file is
 *   decoration. This reports what the bucket actually holds.
 * - `listObjectPaths` — the dev-bucket purge script, which is ADR 0005's
 *   entire orphan mitigation.
 * - `deleteObjects` — FR-4.9, an object is deleted by the same server action
 *   that deletes its row.
 *
 * Authorisation is **not** here. Better Auth issues no Supabase JWT, so
 * Storage row-level security cannot see this application's users and a policy
 * written against `auth.uid()` would be decoration too (FR-4.10). The
 * boundary is the server action: it checks the session first and only then
 * calls anything in this file, using the service-role key.
 */

/** What the browser needs to upload one object, and nothing more. The token
 * is already embedded in `signedUrl`, so a caller never handles it
 * separately. Supabase fixes the validity of this URL at two hours; it is not
 * a parameter of `createSignedUploadUrl`. */
export interface SignedUploadTarget {
  readonly objectPath: string;
  readonly signedUrl: string;
}

/** What the bucket holds at one path — the authority the size and type checks
 * read, as opposed to whatever the browser said it was going to upload. */
export interface StoredObject {
  readonly contentType: string;
  readonly sizeBytes: number;
}

export interface ObjectStorage {
  createSignedUploadTarget(objectPath: string): Promise<SignedUploadTarget>;
  getPublicUrl(objectPath: string): string;
  statObject(objectPath: string): Promise<StoredObject | null>;
  listObjectPaths(prefix: string): Promise<readonly string[]>;
  deleteObjects(objectPaths: readonly string[]): Promise<void>;
}

/** The bucket names from ADR 0005. Both live in one Supabase project; only
 * `SUPABASE_STORAGE_BUCKET` differs between environments. */
export const DEVELOPMENT_STORAGE_BUCKET = "asset-photos-dev";
export const DEPLOYMENT_STORAGE_BUCKET = "asset-photos";

const SUPABASE_URL_VAR = "SUPABASE_URL";
const SERVICE_ROLE_KEY_VAR = "SUPABASE_SERVICE_ROLE_KEY";
const STORAGE_BUCKET_VAR = "SUPABASE_STORAGE_BUCKET";

/** One page of `list()`. Supabase defaults to 100 and caps far higher; 100 is
 * kept because the walk pages until a short page comes back, so a larger page
 * only matters for a bucket this project will never have. */
const LIST_PAGE_SIZE = 100;

/**
 * Raised when object storage refuses an operation. It carries the operation
 * and the object path — `CLAUDE.md` asks errors to be logged with location and
 * input — and it is never rendered: a server action catches it and returns a
 * localised message instead, so no internal error text reaches a user.
 */
export class StorageOperationError extends Error {
  constructor(operation: string, objectPath: string, reason: string) {
    super(`storage.${operation} failed for "${objectPath}": ${reason}`);
    this.name = "StorageOperationError";
  }
}

/** Raised when a required environment variable is absent. Its message names
 * the variable and never its value. */
export class StorageConfigurationError extends Error {
  constructor(variableName: string) {
    super(`${variableName} is not set; object storage cannot be reached.`);
    this.name = "StorageConfigurationError";
  }
}

function readRequiredEnv(variableName: string): string {
  const value = process.env[variableName];
  if (!value) {
    throw new StorageConfigurationError(variableName);
  }
  return value;
}

/** The bucket this process writes to. Read on every call rather than captured
 * at module load, so a script that calls `process.loadEnvFile` after importing
 * this module still sees the right bucket. */
export function getStorageBucket(): string {
  return readRequiredEnv(STORAGE_BUCKET_VAR);
}

/**
 * Refuses any bucket but the development one.
 *
 * The purge script empties a bucket, and one Supabase project holds both, so
 * the same service-role key that empties `asset-photos-dev` can empty
 * `asset-photos`. ADR 0005 records that as a tolerated consequence of a single
 * project; this function is what keeps it tolerable. It is exported and pure
 * so the refusal is a unit test rather than a comment.
 */
export function assertDevelopmentStorageBucket(bucket: string): void {
  if (bucket !== DEVELOPMENT_STORAGE_BUCKET) {
    throw new Error(
      `Refusing to run against "${bucket}". This operation empties a bucket and is allowed only against "${DEVELOPMENT_STORAGE_BUCKET}". Check ${STORAGE_BUCKET_VAR}.`,
    );
  }
}

/**
 * A Supabase client bound to the service-role key.
 *
 * Built per call rather than cached: `createClient` opens no connection, the
 * session machinery is switched off below, and a module-level cache would
 * freeze the first environment it ever saw — which is wrong for a script that
 * loads `.env.local` after import, and wrong for a test.
 */
function createServiceRoleClient(): SupabaseClient {
  return createClient(
    readRequiredEnv(SUPABASE_URL_VAR),
    readRequiredEnv(SERVICE_ROLE_KEY_VAR),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
}

type StorageBucketApi = ReturnType<SupabaseClient["storage"]["from"]>;

function bucketApi(): StorageBucketApi {
  return createServiceRoleClient().storage.from(getStorageBucket());
}

async function createSignedUploadTarget(
  objectPath: string,
): Promise<SignedUploadTarget> {
  const { data, error } = await bucketApi().createSignedUploadUrl(objectPath);
  if (error || !data) {
    throw new StorageOperationError(
      "createSignedUploadTarget",
      objectPath,
      error?.message ?? "no signed URL was returned",
    );
  }
  return { objectPath, signedUrl: data.signedUrl };
}

function getPublicUrl(objectPath: string): string {
  return bucketApi().getPublicUrl(objectPath).data.publicUrl;
}

/**
 * What the bucket holds at `objectPath`, or `null` when it holds nothing.
 *
 * A missing object is a `null`, not a throw: the caller's next step after an
 * upload it cannot find is to refuse the upload, which is an outcome rather
 * than a fault.
 */
async function statObject(objectPath: string): Promise<StoredObject | null> {
  const { data, error } = await bucketApi().info(objectPath);
  if (error || !data) {
    return null;
  }
  return {
    contentType: data.contentType ?? "",
    sizeBytes: data.size ?? 0,
  };
}

interface ListedEntry {
  readonly path: string;
  readonly isFolder: boolean;
}

/** One `list()` page, flattened. Supabase reports a folder as an entry whose
 * `id` is null, which is the only way to tell one from a zero-byte object. */
async function listPage(
  prefix: string,
  offset: number,
): Promise<readonly ListedEntry[]> {
  const { data, error } = await bucketApi().list(prefix, {
    limit: LIST_PAGE_SIZE,
    offset,
  });
  if (error || !data) {
    throw new StorageOperationError(
      "listObjectPaths",
      prefix,
      error?.message ?? "no listing was returned",
    );
  }
  return data.map((entry) => ({
    path: prefix ? `${prefix}/${entry.name}` : entry.name,
    isFolder: entry.id === null,
  }));
}

async function listPrefix(prefix: string): Promise<readonly ListedEntry[]> {
  const entries: ListedEntry[] = [];
  let offset = 0;
  let page = await listPage(prefix, offset);
  while (page.length === LIST_PAGE_SIZE) {
    entries.push(...page);
    offset += LIST_PAGE_SIZE;
    page = await listPage(prefix, offset);
  }
  entries.push(...page);
  return entries;
}

/**
 * Every object at or under `prefix`, recursively.
 *
 * Supabase's `list` is one level deep, so the walk is explicit. It is a
 * worklist rather than a recursive call so the nesting stays inside the depth
 * limit in `CLAUDE.md` and so a deep bucket cannot exhaust the stack.
 */
async function listObjectPaths(prefix: string): Promise<readonly string[]> {
  const objectPaths: string[] = [];
  const pendingPrefixes: string[] = [prefix];

  while (pendingPrefixes.length > 0) {
    const current = pendingPrefixes.pop() ?? "";
    const entries = await listPrefix(current);
    for (const entry of entries) {
      const target = entry.isFolder ? pendingPrefixes : objectPaths;
      target.push(entry.path);
    }
  }
  return objectPaths;
}

/** Deletes objects. An absent path is not an error — the delete path runs
 * after a row is gone, so a retry must not fail on the second attempt. */
async function deleteObjects(objectPaths: readonly string[]): Promise<void> {
  if (objectPaths.length === 0) {
    return;
  }
  const { error } = await bucketApi().remove([...objectPaths]);
  if (error) {
    throw new StorageOperationError(
      "deleteObjects",
      objectPaths.join(", "),
      error.message,
    );
  }
}

const supabaseObjectStorage: ObjectStorage = {
  createSignedUploadTarget,
  getPublicUrl,
  statObject,
  listObjectPaths,
  deleteObjects,
};

/** The one storage implementation. A function rather than a bare export so
 * that a caller cannot capture it before a script has loaded its environment,
 * and so the shape matches how the other seams are reached. */
export function getObjectStorage(): ObjectStorage {
  return supabaseObjectStorage;
}
