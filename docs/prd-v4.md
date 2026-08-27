# PRD v4 - Admin visibility for sign-in lockouts

> Tracker: PRD [#122](https://github.com/jefrykurniaone/inventaris-aset-ppm/issues/122) · Spec [#124](https://github.com/jefrykurniaone/inventaris-aset-ppm/issues/124) · Execution map [#127](https://github.com/jefrykurniaone/inventaris-aset-ppm/issues/127).

## Problem

Issue #112 shipped an account lockout that is deliberately invisible from the outside: a locked address receives the same "Invalid email or password" response as a wrong password, so the response is not an account-enumeration oracle. That property is correct and must not change â€” but it makes the lockout equally invisible to the administrator. On 2026-08-27 this was demonstrated live on production: the administrator's own address was locked by five failed attempts, their correct password was refused with the generic message, and nothing anywhere in the application showed that a lock existed, when it started, or when it would lift. Diagnosis required a SQL query against the `sign_in_attempt` table.

The person with this problem is the administrator of the Direktorat PPM asset inventory: they field "I cannot sign in" reports and currently have no way to distinguish a forgotten password from an active lockout, or to notice a password-guessing campaign at all.

## Goals

1. An administrator can see, inside the application, which addresses are currently locked out of sign-in, when each lock started, and when it lifts â€” in seconds, without database access.
2. An administrator can review the sign-in attempt trail (succeeded / failed / blocked, with timestamps) for any submitted address â€” including addresses that have no account, since those are logged too and are the signal of a guessing campaign.
3. The surface is read-only and admin-only. It observes the lockout mechanism; it does not touch it.

## Non-goals

- **No manual unlock action.** The lock is temporary and self-lifting by design (issue #112): an admin-cleared or admin-clearable lock reopens the denial-of-service question that design deliberately closed. Revisiting that is a policy change, not a visibility feature.
- **No alerting or notifications** (email, dashboard badge, webhook) when a lock occurs. Alerting is a separate product decision with its own delivery questions; this PRD is the pull surface, not the push.
- **No change to the lockout policy** â€” threshold, duration, streak semantics, and the enumeration-safe response all stay exactly as issue #112 shipped them.
- **No change to data collection or retention.** The `sign_in_attempt` table, its 30-day per-address retention, and its write paths are untouched. This is a read path only: no schema change, no new writes, no migration.

## Decisions and constraints

- **Dedicated admin page at `/admin/sign-in-activity`**, navigation label "Aktivitas Masuk" (id) / "Sign-in Activity" (en) â€” chosen over a per-user badge on the user management page because the lockout keys on the submitted address string, not on a `User` row; a users-page badge cannot show attempts against nonexistent addresses, which are the interesting ones. Chosen over a broader `/admin/security` label because the page holds one table and should not promise more.
- **Two sections**: active locks (address, locked at, unlocks at) on top; a paginated attempt trail (address, outcome, timestamp) below, filterable by address search and by outcome, newest first. The trail is what explains a lock and reveals campaigns; locks alone would reintroduce the confusion one question later.
- **Unlock time is computed, not evented.** No lock/unlock event rows exist and none are added; "unlocks at" derives from the existing rows via the same pure evaluation the enforcement path uses, so the page can never disagree with the mechanism it observes.
- **Restricted data.** The table is a list of addresses somebody tried to sign in with. Admin-only, gated the same way the rest of the admin area is; nothing from it reaches any public or staff surface.
- **The UI states the 30-day horizon** so an empty or short trail is not misread as "no attempts ever".
- Existing application conventions bind: URL-parameter-driven tables with no client-side state, localisation of every string in both `id` and `en` in the same pull request, WCAG AA, zero SonarQube findings, and the repository's seam rules.

## Success criteria

- From a "user cannot sign in" report, an administrator determines lock state and lift time from the application alone, without SQL.
- A guessing campaign against any address â€” with or without an account â€” is visible as a filterable trail of `failed` and `blocked` rows.
- The lockout mechanism's behaviour and its enumeration-safety property are byte-for-byte unchanged.

## Out of scope

Manual unlock, alerting, lockout policy changes, retention changes, staff visibility, any write path â€” see non-goals above for the reasoning on each.

