import { describe, expect, it } from "vitest";

import {
  CREDENTIALS_REJECTED_STATUS,
  SIGN_IN_ATTEMPT_RETENTION_DAYS,
  SIGN_IN_FAILURE_THRESHOLD,
  SIGN_IN_LOCK_DURATION_MS,
  classifySignInOutcome,
  evaluateSignInLock,
  normalizeSignInEmail,
  readSignInEmail,
  signInAttemptRetentionCutoff,
  type SignInAttemptOutcome,
  type SignInAttemptRecord,
} from "./sign-in-lockout";

const NOW = new Date("2026-08-27T12:00:00.000Z");
const ONE_MILLISECOND = 1;
const ONE_SECOND_MS = 1_000;
const ONE_DAY_MS = 86_400_000;

/**
 * Builds a newest-first run of attempts one second apart, which is the ordering
 * `evaluateSignInLock` documents as its precondition. `outcomes[0]` is the
 * newest, so its timestamp is `newestAt` and each later entry is older.
 */
function attempts(
  outcomes: readonly SignInAttemptOutcome[],
  newestAt: Date = NOW,
): readonly SignInAttemptRecord[] {
  return outcomes.map((outcome, index) => ({
    outcome,
    createdAt: new Date(newestAt.getTime() - index * ONE_SECOND_MS),
  }));
}

/** `n` consecutive failures, newest first. */
function failures(count: number): readonly SignInAttemptOutcome[] {
  return Array.from({ length: count }, () => "failed" as const);
}

describe("evaluateSignInLock", () => {
  it("reports no lock when nothing has been attempted", () => {
    expect(evaluateSignInLock([], NOW)).toEqual({
      isLocked: false,
      lockedUntil: null,
    });
  });

  it.each([1, 2, 3, 4])(
    "accepts the next attempt after %i consecutive failures",
    (count) => {
      expect(evaluateSignInLock(attempts(failures(count)), NOW)).toEqual({
        isLocked: false,
        lockedUntil: null,
      });
    },
  );

  it("locks on the attempt that reaches the threshold", () => {
    const state = evaluateSignInLock(
      attempts(failures(SIGN_IN_FAILURE_THRESHOLD)),
      NOW,
    );

    expect(state.isLocked).toBe(true);
    expect(state.lockedUntil).toEqual(
      new Date(NOW.getTime() + SIGN_IN_LOCK_DURATION_MS),
    );
  });

  it("stays locked while there is time left on the lock", () => {
    const almostExpired = new Date(
      NOW.getTime() + SIGN_IN_LOCK_DURATION_MS - ONE_MILLISECOND,
    );

    expect(
      evaluateSignInLock(
        attempts(failures(SIGN_IN_FAILURE_THRESHOLD)),
        almostExpired,
      ).isLocked,
    ).toBe(true);
  });

  it("lifts the lock by itself the instant it expires", () => {
    const expired = new Date(NOW.getTime() + SIGN_IN_LOCK_DURATION_MS);
    const state = evaluateSignInLock(
      attempts(failures(SIGN_IN_FAILURE_THRESHOLD)),
      expired,
    );

    expect(state.isLocked).toBe(false);
    expect(state.lockedUntil).toEqual(expired);
  });

  it("runs the lock from the most recent failure, not from the threshold one", () => {
    const newestFailureAt = new Date(NOW.getTime() - ONE_SECOND_MS);
    const state = evaluateSignInLock(
      attempts(failures(SIGN_IN_FAILURE_THRESHOLD + 3), newestFailureAt),
      NOW,
    );

    expect(state.lockedUntil).toEqual(
      new Date(newestFailureAt.getTime() + SIGN_IN_LOCK_DURATION_MS),
    );
  });

  it("clears the streak on a successful sign-in", () => {
    const outcomes = [
      "succeeded" as const,
      ...failures(SIGN_IN_FAILURE_THRESHOLD),
    ];

    expect(evaluateSignInLock(attempts(outcomes), NOW)).toEqual({
      isLocked: false,
      lockedUntil: null,
    });
  });

  it("counts only the failures since the last success", () => {
    const outcomes = [
      ...failures(SIGN_IN_FAILURE_THRESHOLD - 1),
      "succeeded" as const,
      ...failures(SIGN_IN_FAILURE_THRESHOLD),
    ];

    expect(evaluateSignInLock(attempts(outcomes), NOW).isLocked).toBe(false);
  });

  it("neither counts nor clears attempts already refused by the lock", () => {
    const withBlocked: readonly SignInAttemptOutcome[] = [
      "blocked",
      "blocked",
      ...failures(SIGN_IN_FAILURE_THRESHOLD),
    ];
    const blockedOnly: readonly SignInAttemptOutcome[] = [
      ...failures(SIGN_IN_FAILURE_THRESHOLD - 1),
      "blocked",
    ];

    expect(evaluateSignInLock(attempts(withBlocked), NOW).isLocked).toBe(true);
    expect(evaluateSignInLock(attempts(blockedOnly), NOW).isLocked).toBe(false);
  });

  it("anchors the lock to the newest failure when refused attempts are newer", () => {
    const newestFailureAt = new Date(NOW.getTime() - 2 * ONE_SECOND_MS);
    const state = evaluateSignInLock(
      [
        { outcome: "blocked", createdAt: NOW },
        ...attempts(failures(SIGN_IN_FAILURE_THRESHOLD), newestFailureAt),
      ],
      NOW,
    );

    expect(state.lockedUntil).toEqual(
      new Date(newestFailureAt.getTime() + SIGN_IN_LOCK_DURATION_MS),
    );
  });
});

describe("classifySignInOutcome", () => {
  it("records a success when the endpoint returned no error", () => {
    expect(classifySignInOutcome(null)).toBe("succeeded");
  });

  it("counts a rejected credential as a failure", () => {
    expect(classifySignInOutcome(CREDENTIALS_REJECTED_STATUS)).toBe("failed");
  });

  it.each([
    ["a malformed email address", 400],
    ["a deactivated or unverified account, whose password was right", 403],
    ["a rate-limited request", 429],
    ["the application's own fault", 500],
  ])("records nothing for %s", (_case, status) => {
    expect(classifySignInOutcome(status)).toBeNull();
  });
});

describe("normalizeSignInEmail", () => {
  it.each([
    ["Admin@Example.Invalid", "admin@example.invalid"],
    ["  admin@example.invalid  ", "admin@example.invalid"],
    ["ADMIN@EXAMPLE.INVALID", "admin@example.invalid"],
  ])("folds %s into one counter bucket", (input, expected) => {
    expect(normalizeSignInEmail(input)).toBe(expected);
  });
});

describe("readSignInEmail", () => {
  it("returns the submitted address, normalised", () => {
    expect(
      readSignInEmail({ email: " Admin@Example.Invalid ", password: "x" }),
    ).toBe("admin@example.invalid");
  });

  it.each([
    ["the body is absent", undefined],
    ["the body is not an object", "admin@example.invalid"],
    ["there is no email field", { password: "x" }],
    ["the email field is not a string", { email: 42 }],
    ["the email field is blank", { email: "   " }],
  ])("returns null when %s", (_case, body) => {
    expect(readSignInEmail(body)).toBeNull();
  });
});

describe("signInAttemptRetentionCutoff", () => {
  it("keeps the retention window far longer than any lock could last", () => {
    const cutoff = signInAttemptRetentionCutoff(NOW);

    expect(NOW.getTime() - cutoff.getTime()).toBeGreaterThan(
      SIGN_IN_LOCK_DURATION_MS,
    );
  });

  it("cuts off exactly the configured number of days back", () => {
    const cutoff = signInAttemptRetentionCutoff(NOW);
    const days = (NOW.getTime() - cutoff.getTime()) / ONE_DAY_MS;

    expect(days).toBe(SIGN_IN_ATTEMPT_RETENTION_DAYS);
  });
});
