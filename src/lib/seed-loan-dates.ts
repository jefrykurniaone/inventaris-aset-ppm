import type { SeedLoanRole } from "@/lib/seed-asset-mix";

/**
 * The date arithmetic behind the five demonstration loans (issue #16): one
 * clearly overdue, one due soon, two already returned — one on time, one
 * late — and one plain open loan.
 *
 * Pure and injected-`now`, so it is testable against a fixed instant rather
 * than the clock, and so `prisma/seed-data/loan-writer.ts` — the impure half
 * that actually calls `checkOutInTransaction`/`returnInTransaction` — reads
 * as "apply this timing" rather than as date math mixed into database calls.
 *
 * `checkOutInTransaction`'s own `now` parameter exists so a caller can pin
 * the instant `refuseCheckOut` validates against; `checkOutNow` below is
 * always that loan's `checkedOutAt`, because "now" *was* the checkout moment
 * when it happened. `Loan.checkedOutAt` itself still defaults to the real
 * clock at insert time (`@default(now())`), which is why the asset writer
 * has to overwrite it afterwards — see the comment in `loan-writer.ts`.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

function daysFrom(reference: Date, offsetDays: number): Date {
  return new Date(reference.getTime() + offsetDays * DAY_MS);
}

/** `returnedAt` and `returnNow` always arrive or leave together — bundling
 * them means a caller that has checked `returned !== null` never needs a
 * non-null assertion to reach either field. */
export interface SeedLoanReturn {
  readonly returnedAt: Date;
  readonly returnNow: Date;
}

export interface SeedLoanTiming {
  readonly checkedOutAt: Date;
  readonly checkOutNow: Date;
  readonly dueAt: Date;
  readonly returned: SeedLoanReturn | null;
}

/** Day offsets from the real "now" the seed runs at, one named pair per
 * role. Negative is in the past. Chosen so every `dueAt` is strictly after
 * its own `checkedOutAt` (`refuseCheckOut`'s `DUE_DATE_IN_PAST` rule) while
 * still landing wherever issue #16 asks — in the past for `overdue`, in the
 * near future for `dueSoon`, and so on. */
const OVERDUE_OFFSETS = { checkedOutAt: -20, dueAt: -10 } as const;
const DUE_SOON_OFFSETS = { checkedOutAt: -3, dueAt: 3 } as const;
const RETURNED_ON_TIME_OFFSETS = {
  checkedOutAt: -60,
  dueAt: -50,
  returnedAt: -52,
} as const;
const RETURNED_LATE_OFFSETS = {
  checkedOutAt: -40,
  dueAt: -30,
  returnedAt: -25,
} as const;
const PLAIN_ACTIVE_OFFSETS = { checkedOutAt: -5, dueAt: 20 } as const;

function openLoanTiming(
  now: Date,
  offsets: { readonly checkedOutAt: number; readonly dueAt: number },
): SeedLoanTiming {
  const checkedOutAt = daysFrom(now, offsets.checkedOutAt);
  return {
    checkedOutAt,
    checkOutNow: checkedOutAt,
    dueAt: daysFrom(now, offsets.dueAt),
    returned: null,
  };
}

function returnedLoanTiming(
  now: Date,
  offsets: {
    readonly checkedOutAt: number;
    readonly dueAt: number;
    readonly returnedAt: number;
  },
): SeedLoanTiming {
  const returnedAt = daysFrom(now, offsets.returnedAt);
  return {
    ...openLoanTiming(now, offsets),
    returned: { returnedAt, returnNow: returnedAt },
  };
}

/** The timing for one loan role, relative to `now`. */
export function loanTimingFor(role: SeedLoanRole, now: Date): SeedLoanTiming {
  switch (role) {
    case "overdue":
      return openLoanTiming(now, OVERDUE_OFFSETS);
    case "dueSoon":
      return openLoanTiming(now, DUE_SOON_OFFSETS);
    case "returnedA":
      return returnedLoanTiming(now, RETURNED_ON_TIME_OFFSETS);
    case "returnedB":
      return returnedLoanTiming(now, RETURNED_LATE_OFFSETS);
    case "plainActive":
      return openLoanTiming(now, PLAIN_ACTIVE_OFFSETS);
    default: {
      const exhaustive: never = role;
      throw new Error(`seed-loan-dates: unhandled loan role "${exhaustive}".`);
    }
  }
}
