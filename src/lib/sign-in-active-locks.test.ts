import { describe, expect, it } from "vitest";

import {
  activeSignInLockWindowStart,
  buildActiveSignInLockCandidateWhere,
  buildSignInLockAttemptsWhere,
  collectActiveSignInLocks,
  type SignInLockCandidate,
} from "./sign-in-active-locks";
import {
  SIGN_IN_FAILURE_THRESHOLD,
  SIGN_IN_LOCK_DURATION_MS,
  type SignInAttemptOutcome,
  type SignInAttemptRecord,
} from "./sign-in-lockout";

const NOW = new Date("2026-08-27T12:00:00.000Z");
const ONE_MILLISECOND = 1;
const ONE_SECOND_MS = 1_000;

/** Newest-first attempts one second apart — the ordering
 * `evaluateSignInLock` documents as its precondition, so `outcomes[0]` is the
 * newest and carries `newestAt`. */
function attempts(
  outcomes: readonly SignInAttemptOutcome[],
  newestAt: Date = NOW,
): readonly SignInAttemptRecord[] {
  return outcomes.map((outcome, index) => ({
    outcome,
    createdAt: new Date(newestAt.getTime() - index * ONE_SECOND_MS),
  }));
}

/** `count` consecutive failures, newest first. */
function failures(count: number): readonly SignInAttemptOutcome[] {
  return Array.from({ length: count }, () => "failed" as const);
}

function candidate(
  email: string,
  outcomes: readonly SignInAttemptOutcome[],
  newestAt: Date = NOW,
): SignInLockCandidate {
  return {
    email,
    recentAttemptsNewestFirst: attempts(outcomes, newestAt),
  };
}

/** The threshold streak, anchored to `newestAt`. */
function lockedCandidate(email: string, newestAt: Date): SignInLockCandidate {
  return candidate(email, failures(SIGN_IN_FAILURE_THRESHOLD), newestAt);
}

describe("activeSignInLockWindowStart", () => {
  it("reaches back exactly one lock duration", () => {
    expect(activeSignInLockWindowStart(NOW)).toEqual(
      new Date(NOW.getTime() - SIGN_IN_LOCK_DURATION_MS),
    );
  });
});

describe("buildActiveSignInLockCandidateWhere", () => {
  it("asks only for failures recent enough to still anchor a lock", () => {
    expect(buildActiveSignInLockCandidateWhere(NOW)).toEqual({
      outcome: "failed",
      createdAt: { gte: activeSignInLockWindowStart(NOW) },
    });
  });
});

describe("buildSignInLockAttemptsWhere", () => {
  it("excludes refused attempts, exactly as the enforcement read does", () => {
    expect(buildSignInLockAttemptsWhere("admin@example.invalid")).toEqual({
      email: "admin@example.invalid",
      outcome: { not: "blocked" },
    });
  });
});

describe("collectActiveSignInLocks", () => {
  it("reports nothing when there are no candidates at all", () => {
    expect(collectActiveSignInLocks([], NOW)).toEqual([]);
  });

  it.each([1, 2, 3, 4])(
    "leaves an address with %i consecutive failures unlocked",
    (count) => {
      const candidates = [candidate("under@example.invalid", failures(count))];

      expect(collectActiveSignInLocks(candidates, NOW)).toEqual([]);
    },
  );

  it("reports the address whose failures reached the threshold", () => {
    const candidates = [lockedCandidate("locked@example.invalid", NOW)];

    expect(collectActiveSignInLocks(candidates, NOW)).toEqual([
      {
        email: "locked@example.invalid",
        lockedAt: NOW,
        lockedUntil: new Date(NOW.getTime() + SIGN_IN_LOCK_DURATION_MS),
      },
    ]);
  });

  it("reports an address with no account exactly like any other", () => {
    const candidates = [lockedCandidate("nobody@example.invalid", NOW)];
    const [lock] = collectActiveSignInLocks(candidates, NOW);

    expect(lock.email).toBe("nobody@example.invalid");
  });

  it("anchors locked-at to the most recent failure, not to the threshold one", () => {
    const newestFailureAt = new Date(NOW.getTime() - 30 * ONE_SECOND_MS);
    const candidates = [
      candidate(
        "streak@example.invalid",
        failures(SIGN_IN_FAILURE_THRESHOLD + 3),
        newestFailureAt,
      ),
    ];

    expect(collectActiveSignInLocks(candidates, NOW)).toEqual([
      {
        email: "streak@example.invalid",
        lockedAt: newestFailureAt,
        lockedUntil: new Date(
          newestFailureAt.getTime() + SIGN_IN_LOCK_DURATION_MS,
        ),
      },
    ]);
  });

  it("drops an address whose streak a successful sign-in reset", () => {
    const candidates = [
      candidate("recovered@example.invalid", [
        "succeeded",
        ...failures(SIGN_IN_FAILURE_THRESHOLD),
      ]),
    ];

    expect(collectActiveSignInLocks(candidates, NOW)).toEqual([]);
  });

  it("keeps a lock that refused attempts sit on top of, without extending it", () => {
    const newestFailureAt = new Date(NOW.getTime() - 2 * ONE_SECOND_MS);
    const candidates: readonly SignInLockCandidate[] = [
      {
        email: "hammered@example.invalid",
        recentAttemptsNewestFirst: [
          { outcome: "blocked", createdAt: NOW },
          ...attempts(failures(SIGN_IN_FAILURE_THRESHOLD), newestFailureAt),
        ],
      },
    ];

    expect(collectActiveSignInLocks(candidates, NOW)).toEqual([
      {
        email: "hammered@example.invalid",
        lockedAt: newestFailureAt,
        lockedUntil: new Date(
          newestFailureAt.getTime() + SIGN_IN_LOCK_DURATION_MS,
        ),
      },
    ]);
  });

  it("does not let refused attempts alone lock an address", () => {
    const candidates = [
      candidate("refused@example.invalid", [
        ...failures(SIGN_IN_FAILURE_THRESHOLD - 1),
        "blocked",
      ]),
    ];

    expect(collectActiveSignInLocks(candidates, NOW)).toEqual([]);
  });

  it("keeps a lock with a millisecond left on it", () => {
    const anchor = new Date(
      NOW.getTime() - SIGN_IN_LOCK_DURATION_MS + ONE_MILLISECOND,
    );

    expect(
      collectActiveSignInLocks(
        [lockedCandidate("edge@example.invalid", anchor)],
        NOW,
      ),
    ).toHaveLength(1);
  });

  it("drops a lock the instant it expires", () => {
    const anchor = new Date(NOW.getTime() - SIGN_IN_LOCK_DURATION_MS);

    expect(
      collectActiveSignInLocks(
        [lockedCandidate("expired@example.invalid", anchor)],
        NOW,
      ),
    ).toEqual([]);
  });

  it("keeps only the locked addresses out of an interleaved set", () => {
    const oldestLockAnchor = new Date(NOW.getTime() - 10 * ONE_SECOND_MS);
    const newestLockAnchor = new Date(NOW.getTime() - ONE_SECOND_MS);
    const candidates = [
      lockedCandidate("second@example.invalid", newestLockAnchor),
      candidate("clean@example.invalid", [
        "succeeded",
        ...failures(SIGN_IN_FAILURE_THRESHOLD),
      ]),
      lockedCandidate(
        "expired@example.invalid",
        new Date(NOW.getTime() - SIGN_IN_LOCK_DURATION_MS),
      ),
      lockedCandidate("first@example.invalid", oldestLockAnchor),
      candidate(
        "under@example.invalid",
        failures(SIGN_IN_FAILURE_THRESHOLD - 1),
      ),
    ];

    expect(
      collectActiveSignInLocks(candidates, NOW).map((lock) => lock.email),
    ).toEqual(["first@example.invalid", "second@example.invalid"]);
  });

  it("breaks a tie on the address so the order never depends on the query", () => {
    const candidates = [
      lockedCandidate("zoe@example.invalid", NOW),
      lockedCandidate("amir@example.invalid", NOW),
    ];

    expect(
      collectActiveSignInLocks(candidates, NOW).map((lock) => lock.email),
    ).toEqual(["amir@example.invalid", "zoe@example.invalid"]);
  });
});
