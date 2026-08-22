import { db } from "@/lib/db";

import { seedAssets } from "./asset-writer";
import { seedDemoUsers } from "./demo-users-writer";
import { seedLoans } from "./loan-writer";
import { seedMasterData } from "./master-data-writer";
import { seedPhotos } from "./photo-writer";

/**
 * Orchestrates the whole demonstration dataset (issue #16), on top of the
 * administrator issue #41 already seeds: two `staff` accounts, master data,
 * sixty assets, five loans, and — when object storage is configured —
 * their photos.
 *
 * Kept as one function so `prisma/seed.ts`'s `main` stays a short list of
 * stages. Imported with a dynamic `import("./seed-data")` from there, never
 * a static one — `@/lib/db` is imported at this module's top level, and
 * `src/lib/db.ts` reads `DATABASE_URL` the moment it is imported, before
 * `prisma/seed.ts`'s own `loadDevEnv()` has populated it from `.env.local`.
 * A static import here would be hoisted ahead of that call; the dynamic
 * import in `main()` runs only once execution actually reaches it.
 */

export interface SeedDemoDatasetResult {
  readonly messages: readonly string[];
}

export async function seedDemoDataset(
  env: Readonly<Record<string, string | undefined>>,
  adminId: string,
): Promise<SeedDemoDatasetResult> {
  const messages: string[] = [];

  const demoUsers = await seedDemoUsers(env);
  messages.push(...demoUsers.messages);

  const masterData = await seedMasterData(db);
  messages.push(...masterData.messages);

  const assets = await seedAssets(masterData.refs, adminId);
  messages.push(...assets.messages);

  const loans = await seedLoans({
    assetIdBySeedKey: assets.assetIdBySeedKey,
    planBySeedKey: assets.planBySeedKey,
    actorIds: demoUsers.staffIds,
  });
  messages.push(...loans);

  const photos = await seedPhotos(
    {
      assetIdBySeedKey: assets.assetIdBySeedKey,
      planBySeedKey: assets.planBySeedKey,
      actorId: adminId,
    },
    env,
  );
  messages.push(...photos);

  return { messages };
}
