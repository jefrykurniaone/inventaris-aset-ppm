import { describe, expect, it } from "vitest";

import { SEED_LOAN_ROLES } from "./seed-asset-mix";
import { loanTimingFor } from "./seed-loan-dates";

const NOW = new Date("2026-08-22T00:00:00.000Z");

describe("loanTimingFor", () => {
  it("overdue: due date in the past, still open", () => {
    const timing = loanTimingFor("overdue", NOW);

    expect(timing.dueAt.getTime()).toBeLessThan(NOW.getTime());
    expect(timing.dueAt.getTime()).toBeGreaterThan(
      timing.checkedOutAt.getTime(),
    );
    expect(timing.returned).toBeNull();
  });

  it("dueSoon: due date in the near future, still open", () => {
    const timing = loanTimingFor("dueSoon", NOW);

    expect(timing.dueAt.getTime()).toBeGreaterThan(NOW.getTime());
    expect(timing.dueAt.getTime()).toBeGreaterThan(
      timing.checkedOutAt.getTime(),
    );
    expect(timing.returned).toBeNull();
  });

  it("returnedA: returned before its due date", () => {
    const timing = loanTimingFor("returnedA", NOW);

    expect(timing.returned).not.toBeNull();
    expect(timing.returned?.returnedAt.getTime()).toBeLessThan(
      timing.dueAt.getTime(),
    );
    expect(timing.returned?.returnNow).toEqual(timing.returned?.returnedAt);
  });

  it("returnedB: returned after its due date", () => {
    const timing = loanTimingFor("returnedB", NOW);

    expect(timing.returned).not.toBeNull();
    expect(timing.returned?.returnedAt.getTime()).toBeGreaterThan(
      timing.dueAt.getTime(),
    );
  });

  it("plainActive: comfortably open, not due soon", () => {
    const timing = loanTimingFor("plainActive", NOW);

    expect(timing.returned).toBeNull();
    expect(timing.dueAt.getTime()).toBeGreaterThan(NOW.getTime());
  });

  it("every role's checkOutNow is strictly before its dueAt", () => {
    for (const role of SEED_LOAN_ROLES) {
      const timing = loanTimingFor(role, NOW);
      expect(timing.checkOutNow.getTime()).toBeLessThan(timing.dueAt.getTime());
    }
  });
});
