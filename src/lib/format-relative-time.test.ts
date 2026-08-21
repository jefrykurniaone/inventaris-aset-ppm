import { describe, expect, it } from "vitest";

import { formatRelativeTime } from "./format-relative-time";

const NOW = new Date("2026-08-21T10:00:00.000Z");

const HOURS_2_MS = 2 * 60 * 60 * 1000;
const DAYS_3_MS = 3 * 24 * 60 * 60 * 1000;
const YEARS_2_MS = 2 * 365 * 24 * 60 * 60 * 1000;

describe("formatRelativeTime", () => {
  it("renders a past hour offset for id", () => {
    const twoHoursAgo = new Date(NOW.getTime() - HOURS_2_MS);
    expect(formatRelativeTime(twoHoursAgo, "id", NOW)).toBe("2 jam yang lalu");
  });

  it("renders a past hour offset for en", () => {
    const twoHoursAgo = new Date(NOW.getTime() - HOURS_2_MS);
    expect(formatRelativeTime(twoHoursAgo, "en", NOW)).toBe("2 hours ago");
  });

  it("renders a future day offset for a loan due date not yet overdue", () => {
    const inThreeDays = new Date(NOW.getTime() + DAYS_3_MS);
    expect(formatRelativeTime(inThreeDays, "en", NOW)).toBe("in 3 days");
    expect(formatRelativeTime(inThreeDays, "id", NOW)).toBe("dalam 3 hari");
  });

  it("renders the current instant as now", () => {
    expect(formatRelativeTime(NOW, "en", NOW)).toBe("now");
  });

  it("falls through to years for a multi-year offset", () => {
    const twoYearsAgo = new Date(NOW.getTime() - YEARS_2_MS);
    expect(formatRelativeTime(twoYearsAgo, "en", NOW)).toBe("2 years ago");
  });

  it("defaults `now` to the current instant when omitted", () => {
    const almostNow = new Date(Date.now() - 1000);
    expect(formatRelativeTime(almostNow, "en")).toBe("1 second ago");
  });
});
