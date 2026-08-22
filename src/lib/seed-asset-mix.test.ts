import { describe, expect, it } from "vitest";

import {
  buildAssetPlan,
  conditionFor,
  loanRoleFor,
  photoCountFor,
  seedKeyFor,
  statusFor,
  type SeedAssetRefs,
  type SeedCatalogItem,
} from "./seed-asset-mix";

const CATEGORY_CODES = ["LAB", "IT", "FUR", "OFC", "OTH"] as const;
const ITEMS_PER_CATEGORY = 12;
const CATALOG_SIZE = CATEGORY_CODES.length * ITEMS_PER_CATEGORY;

function buildFakeCatalog(): readonly SeedCatalogItem[] {
  return Array.from({ length: CATALOG_SIZE }, (_, index) => ({
    categoryCode: CATEGORY_CODES[Math.floor(index / ITEMS_PER_CATEGORY)],
    name: `Item ${index}`,
    brand: "Brand",
    model: "Model",
    basePriceIdr: 1_000_000 + index,
  }));
}

const FAKE_REFS: SeedAssetRefs = {
  categoryIdByCode: Object.fromEntries(
    CATEGORY_CODES.map((code) => [code, `category-${code}`]),
  ),
  roomIds: ["room-1", "room-2", "room-3"],
  fundingSourceIds: ["funding-1", "funding-2"],
};

describe("seedKeyFor", () => {
  it("pads and is one-based", () => {
    expect(seedKeyFor(0)).toBe("SEED-001");
    expect(seedKeyFor(9)).toBe("SEED-010");
    expect(seedKeyFor(59)).toBe("SEED-060");
  });
});

describe("statusFor", () => {
  it("reports exactly one lost asset", () => {
    const statuses = Array.from({ length: CATALOG_SIZE }, (_, i) =>
      statusFor(i),
    );
    expect(statuses.filter((status) => status === "lost")).toHaveLength(1);
  });

  it("reports a couple of retired assets", () => {
    const statuses = Array.from({ length: CATALOG_SIZE }, (_, i) =>
      statusFor(i),
    );
    expect(statuses.filter((status) => status === "retired")).toHaveLength(2);
  });

  it("reports several in_repair assets", () => {
    const statuses = Array.from({ length: CATALOG_SIZE }, (_, i) =>
      statusFor(i),
    );
    expect(statuses.filter((status) => status === "in_repair")).toHaveLength(6);
  });
});

describe("conditionFor", () => {
  it("never assigns both poor and fair to the same index", () => {
    for (let index = 0; index < CATALOG_SIZE; index += 1) {
      expect(["good", "fair", "poor"]).toContain(conditionFor(index));
    }
    const conditions = Array.from({ length: CATALOG_SIZE }, (_, i) =>
      conditionFor(i),
    );
    expect(conditions.filter((c) => c === "poor")).toHaveLength(5);
    expect(conditions.filter((c) => c === "fair")).toHaveLength(15);
  });
});

describe("loanRoleFor", () => {
  it("assigns each of the five roles to exactly one index, all active", () => {
    const roles = Array.from({ length: CATALOG_SIZE }, (_, i) =>
      loanRoleFor(i),
    ).filter((role): role is NonNullable<typeof role> => role !== null);

    expect(roles).toHaveLength(5);
    expect(new Set(roles).size).toBe(5);

    for (let index = 0; index < CATALOG_SIZE; index += 1) {
      if (loanRoleFor(index) !== null) {
        expect(statusFor(index)).toBe("active");
      }
    }
  });
});

describe("photoCountFor", () => {
  it("gives ~15 assets a photo, five of them a second one", () => {
    const counts = Array.from({ length: CATALOG_SIZE }, (_, i) =>
      photoCountFor(i),
    );
    expect(counts.filter((count) => count > 0)).toHaveLength(15);
    expect(counts.filter((count) => count === 2)).toHaveLength(5);
    expect(counts.filter((count) => count === 1)).toHaveLength(10);
  });
});

describe("buildAssetPlan", () => {
  it("builds one plan item per catalog item, with unique seed keys", () => {
    const plan = buildAssetPlan(buildFakeCatalog(), FAKE_REFS);

    expect(plan).toHaveLength(CATALOG_SIZE);
    expect(new Set(plan.map((item) => item.seedKey)).size).toBe(CATALOG_SIZE);
  });

  it("resolves categoryId, roomId and fundingSourceId from refs", () => {
    const plan = buildAssetPlan(buildFakeCatalog(), FAKE_REFS);

    for (const item of plan) {
      expect(FAKE_REFS.roomIds).toContain(item.roomId);
      expect(FAKE_REFS.fundingSourceIds).toContain(item.fundingSourceId);
    }
    expect(plan[0].categoryId).toBe("category-LAB");
    expect(plan[ITEMS_PER_CATEGORY].categoryId).toBe("category-IT");
  });

  it("formats purchasePrice with two decimal places", () => {
    const plan = buildAssetPlan(buildFakeCatalog(), FAKE_REFS);
    expect(plan[0].purchasePrice).toBe("1000000.00");
  });

  it("spreads acquisition years across roughly five years", () => {
    const plan = buildAssetPlan(buildFakeCatalog(), FAKE_REFS);
    const years = new Set(plan.map((item) => item.acquisitionYear));
    expect(years.size).toBe(5);
  });
});
