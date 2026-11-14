# Spec v1 - Advisory unblock: upgrade Better Auth past its advisories, merge the waiting Dependabot PRs, make security alerts raise a PR

> Tracker: Spec [#186](https://github.com/jefrykurniaone/inventaris-aset-ppm/issues/186) · Execution map [#191](https://github.com/jefrykurniaone/inventaris-aset-ppm/issues/191) · Run label `run:advisory-unblock`.
> Point-in-time copy of the spec item as of 2026-11-14, against `main` at `c04b4f3`. The spec item is the one written copy.

## Problem statement

As of 2026-11-14, no pull request can merge into `main`. The required check *Audit production dependencies* (`npm audit --audit-level=high --omit=dev`) fails on `main` itself, whatever a pull request changes. The cause is `better-auth@1.7.1`, which is pinned exactly and may move only with an ADR. Three advisories against it were published on 2026-11-03, and all three are patched in 1.7.7:

- GHSA-965c-763c-88jm (critical): OAuth state can be used as a Magic Link to sign in as another user.
- GHSA-r4xp-prcw-77qf (high): the OAuth Proxy lets an attacker sign in as another user.
- GHSA-44jh-23m7-hpcf (low): concurrent requests can exceed `@better-auth/drizzle-adapter` rate limits on PostgreSQL.

None of them reaches this application's configuration. The application uses email-and-password sign-in, the admin plugin and the Prisma adapter. It has no magic link, no OAuth or social provider, no OAuth proxy and no Drizzle adapter. The risk to users is therefore low. The cost is that the gate is red for every change.

Three Dependabot pull requests are waiting behind that gate, and each fails only the audit check:

- #183 moves `SonarSource/sonarqube-scan-action` from 8.3.0 to 8.4.0. It is the monthly GitHub Actions version update, not a security change. Review finding: the comment beside the pinned commit still names `v8.2.1`, one release behind the commit pinned today.
- #184 moves `@hono/node-server` from 2.1.1 to 2.1.8. It is a Dependabot security update for GHSA-jpvv-r467-5p4w (medium).
- #185 moves `hono` from 4.13.13 to 4.13.18. It is a Dependabot security update for five advisories: four medium, one low.

`hono` and `@hono/node-server` reach the dependency tree only through the shadcn CLI's MCP SDK, in development scope. They never run in the application.

The critical alert stayed open for eleven days without anyone acting on it. On 2026-11-03 Dependabot tried four times to open a security update for `better-auth`, and each attempt failed with `all_versions_ignored`. The Dependabot configuration ignores the ADR-gated packages (`prisma`, `@prisma/client`, `@prisma/adapter-pg`, `better-auth`, `auth`) for every kind of update. An ignore rule without update types applies to security updates as well. ADR 0008 makes Dependabot alerts the surface between pull requests and notes that "someone has to read the alerts", but nothing made sure that someone did.

## Solution

- Better Auth and its CLI move together from 1.7.1 to 1.7.23 under a new ADR 0010, and both stay exact pins. The audit goes green on `main`.
- A migration removes the `account.issuer` column and its unique index, which Better Auth 1.7.3 dropped upstream, so that creating an account keeps working.
- The three Dependabot pull requests are reviewed, fixed where needed, and merged one after another.
- A future advisory against an ADR-gated package opens a Dependabot security pull request. That pull request cannot merge as-is, but it works as an alarm.
- The owner's GitHub notifications are set so that a Dependabot alert reaches their inbox.

## Goals and non-goals

Goals:

- `main` passes all four required checks again.
- #183, #184 and #185 are merged with merge commits.
- Account creation and sign-in work on 1.7.23. Account creation covers both an administrator creating a staff account and the seed.
- An advisory against an ADR-gated package produces a visible pull request.
- The documentation describes the vulnerability checks as they really are.

Non-goals:

- No scheduled (cron) audit and no CodeQL. ADR 0008's decision stands, re-confirmed on 2026-11-14.
- No new Better Auth features.
- No change to the audit's scope or threshold.
- No change to how sign-in lockout behaves.

## User stories

1. As a developer, I want the audit check on `main` to pass, so that my pull requests can merge when they are correct.
2. As the maintainer, I want Better Auth on a release without known advisories, so that the dependency audit reflects real risk.
3. As an administrator, I want to keep creating staff accounts after the upgrade, so that an upstream schema change does not break onboarding.
4. As a staff member, I want to keep signing in with my existing account after the upgrade, so that the upgrade is invisible to me.
5. As the maintainer, I want the waiting Dependabot pull requests merged, so that dev tooling is off its advisories and the SonarQube action is current.
6. As the maintainer, I want the version comment beside the pinned SonarQube action commit to stay correct by itself, so that a reader can tell which release is pinned without resolving the SHA.
7. As the maintainer, I want an advisory against an ADR-gated package to open a pull request, so that it shows up where I already look.
8. As the maintainer, I want Dependabot alerts emailed to me, so that a critical advisory does not sit unread for days.
9. As a future maintainer, I want the ADRs and the project instructions to describe the vulnerability checks and the auth-schema rule as they really are, so that I do not act on stale documentation.

## Implementation decisions

### Better Auth 1.7.1 → 1.7.23 (ADR 0010)

- `better-auth` and `auth` move together to exactly 1.7.23, and they cannot be moved apart. Each `auth@N` pins `better-auth`, `@better-auth/core` and `@better-auth/telemetry` to exactly N, and `better-auth@N` pins its adapters exactly. The peer ranges still accept Prisma 7.10.1 and Next 15.
- **Why 1.7.23 rather than the minimum patched 1.7.7.** The schema work is identical for both. Eleven further advisories, published on 2026-11-03, are patched only from 1.7.16. As of 2026-11-14 they are not yet in the global advisory database that `npm audit` reads, so with 1.7.7 the audit would likely go red again once they arrive. None of the eleven reaches this configuration either: they need the phone plugin, cookie cache or secondary storage, change-email, Expo, Electron, OTP, organization, passkey, Stripe, MySQL or OAuth. The trade-off accepted is that 1.7.23 is new: it was published on 2026-11-13.
- ADR 0010 follows ADR 0007 as its prior art. It records:
  - the three advisories and why none reaches this application;
  - the version choice;
  - the `issuer` removal, and why it is a hand edit;
  - the behaviour notes below;
  - the upstream rollback warning;
  - the verification results.

### Removing `account.issuer`

- Better Auth 1.7.0–1.7.2 required `account.issuer`, with a unique index on `(issuer, accountId)` named `account_issuer_accountId_uidx`. Version 1.7.3 removed both and no longer writes `issuer`. While the column stays `NOT NULL`, every account insert fails. That includes the admin plugin's create-user, which the seed also uses.
- The fix removes the field and the index from the auth Prisma model entirely. The migration drops the index first, then the column.
  - **Why removal rather than a nullable column.** The upstream guide's minimal step is to make the column nullable. Removing it instead makes the auth model exactly what a fresh generation produces, plus the four hand-written relation fields, which restores the invariant the project instructions state.
  - **Why the irreversibility costs nothing.** Nothing reads `issuer` any more, and the only databases are local development ones (ADR 0009).
- It has to be a hand edit. The project's generation script points the CLI at the existing model file, and the generator in `auth@1.7.23` only appends fields and indexes; it never removes one. This was verified by reading the shipped generator on 2026-11-14. Run against a schema that still has `issuer`, the script prints "Your schema is already up to date." together with an `unexpected-required-column` warning that points at the 1.7 upgrade guide. After the edit it must print "already up to date" with no warning.
- Before the migration is applied to the development database, it is checked for duplicate `(providerId, accountId)` pairs, using the query from the upstream upgrade guide. Any duplicate stops the run.
- The schema check Better Auth runs at start-up does not catch this case here. According to the upstream database docs (v1.7.15), the compact data model of the `prisma-client` generator carries no nullability, so the failure would surface only as a failed insert.
- Upstream warns that once 1.7.3 or later has created accounts without `issuer`, downgrading the packages alone is not a safe rollback. ADR 0010 records this.

### Project instructions: columns dropped upstream

The *Auth tables* section of the project instructions gains one rule. Because the generator never removes anything, a column that Better Auth drops upstream is removed by hand, and only under an ADR. Afterwards the generation script must again print "already up to date" with no warning. The rest of the section stands, including the rule never to hand-write or hand-edit an auth column.

### Admin access control

Better Auth 1.7.16 added `set-phone` to the admin plugin's default `user` statements. This project spells the statements out and documents them as copied unchanged from the plugin defaults. To keep that true, `set-phone` is added to the statements and granted to the admin role. The staff role still holds no permission. No phone plugin is installed, so this changes no behaviour.

### Behaviour notes: recorded, not changed

- Since 1.7.6, a password over the maximum length is rejected with `400 PASSWORD_TOO_LONG` before hashing. Sign-in lockout counts only a `401` as a failed attempt, so these attempts are neither logged nor counted. A password that long cannot match any account, so this opens no brute-force path, and no code changes.
- Version 1.7.8 changed cookie attributes to follow RFC 6265bis. The end-to-end sign-in covers this; it is not diffed by hand.

### Dependabot ignores ADR-gated packages for version updates only

Each of the five ADR-gated ignore entries gains update types, so that it no longer suppresses security updates:

```yaml
- dependency-name: better-auth
  update-types:
    - version-update:semver-minor
    - version-update:semver-patch
```

Major updates are already ignored for every package by a separate rule.

The ignore exists, and stays in place for version updates, for three reasons:

- These packages move only with an ADR.
- The npm configuration groups every minor and patch update into one pull request. An ADR-gated package inside that group would hold every routine update hostage.
- They move in coupled sets.

Security updates do not join that group, because it applies to version updates only, so each security update arrives as a pull request of its own. That pull request is an alarm, not something to merge. The response is an ADR and a separate upgrade pull request, after which Dependabot's pull request is closed. Dependabot's own log from 2026-11-03 confirms the behaviour: an ignore rule with update types "doesn't apply to security update".

### ADR 0008 amendment

A dated amendment to ADR 0008 records:

- the change above, and why: the eleven-day gap;
- the notification setup below, as the human half of "someone has to read the alerts";
- that there is still no cron and no CodeQL, re-confirmed on 2026-11-14;
- two corrections:
  - `main` has four required checks, not three; `SonarQube Cloud` is required as well.
  - The end-to-end job no longer skips its steps; it runs and passes.

### Notifications

No API exposes a user's GitHub notification settings, so the owner sets them by hand: email for Dependabot alerts, and watching the repository with security alerts. The `gh` token gains the `notifications` scope, so the watch state can be read from the command line. ADR 0008's amendment carries the steps.

### #183: SonarQube scan action

- The stale `v8.2.1` comment above the pinned commit is replaced by a trailing version comment on the `uses:` line (`@<sha> # v8.4.0`). Dependabot rewrites a comment in that form on every bump, so it cannot go stale again.
- The commit goes onto Dependabot's branch. Dependabot stops rebasing a branch once a human has committed to it, so from then on that branch is updated by hand.
- The pinned SHA was checked against the `v8.4.0` tag (`4d1dc0c…`), and they match.

### Merge order

1. The upgrade lands first, so that `main` is green.
2. #183.
3. #185 (`hono`).
4. #184 (`@hono/node-server`).

Branch protection requires branches to be up to date, and #184 and #185 both change the lockfile. Between merges, the next branch is updated or rebased and all required checks must pass. Every merge is a merge commit, and the branch is deleted on both sides. There is no admin bypass: administrator enforcement is off, but the project rule is that CI passes before merge.

## Testing decisions

A good test here observes the product from outside: a database built from the migration history, an account created through the library, a sign-in in a real browser, a check result on a pull request. No unit tests are added, for three reasons:

- The upgrade adds no business logic.
- The end-to-end path already catches the riskiest regression.
- A parity test against the plugin's default statements would have to import Better Auth outside the two modules allowed to import it.

The seams, highest first, were confirmed on 2026-11-14:

1. **End-to-end smoke in CI** (existing). It runs a fresh Postgres 17, applies the full migration history, seeds an administrator through create-user, then does a real sign-in, an asset, a photo, a label and the public scan page.
   - Catches: the `issuer` insert failure, the new migration applying from zero, and the sign-in and cookie changes.
   - Misses: an existing database with data, admin permissions, and lockout.
2. **Development-database verification, run by the orchestrator** after `migrate dev`. It runs the duplicate check, confirms the generation script prints "already up to date" with no warning, and runs the existing admin-role-model and sign-in-lockout verification scripts.
   - Catches: the migration over existing data, generator and schema parity, admin and staff roles, and lockout on the new version.
   - Misses: the browser UI.
3. **Audit and dependency review in CI** (existing).
   - Catches: the advisories being closed, and any new vulnerable dependency.
   - Misses: advisories not yet in the global database.
4. **The first "Dependabot Updates" run after the configuration merges.** Its job definition must list the five ignore conditions with update types.
   - Catches: whether the configuration is read, and whether the ignore still applies to security updates.
   - Misses: a live alarm, which only a future advisory can show.

Prior art: ADR 0007, an ADR-gated Prisma upgrade with its verification table, and the verification scripts introduced for the role model and for lockout.

## Success criteria

- [ ] `npm audit --audit-level=high --omit=dev` exits 0 on `main`.
- [ ] `better-auth` and `auth` are exactly 1.7.23 in the manifest and the lockfile, and `npm ls better-auth` shows a single version.
- [ ] The auth model has no `issuer` field and no `(issuer, accountId)` index, and a migration drops both.
- [ ] The generation script prints "Your schema is already up to date." with no warning.
- [ ] The end-to-end smoke test passes on the upgrade pull request.
- [ ] The admin-role-model and sign-in-lockout verification scripts pass against the migrated development database.
- [ ] ADR 0010 exists and is linked from the ADR index.
- [ ] ADR 0008 carries the dated amendment.
- [ ] The project instructions carry the rule for columns dropped upstream.
- [ ] The Dependabot configuration ignores the five ADR-gated packages for minor and patch version updates only, and the next Dependabot run's job definition shows it.
- [ ] #183 carries the trailing version comment and is merged.
- [ ] #185 and #184 are merged.
- [ ] Every merge is a merge commit made with every required check green, and each merged branch is deleted.
- [ ] The owner has email notification for Dependabot alerts and watches the repository.
- [ ] The `gh` token has the `notifications` scope.

## Out of scope

- A scheduled audit, or CodeQL.
- Moving from `better-auth/adapters/prisma` to the separate `@better-auth/prisma-adapter` package.
- Any other Better Auth feature or option, and Better Auth 1.8 (in beta).
- Upgrading Prisma.
- Counting `400` responses toward sign-in lockout.
- Dismissing or changing the accepted `braces` alerts (ADR 0004).
- A workflow that turns alerts into issues, which would need a cron.

## Further notes

- The Dependabot alerts for `better-auth` close by themselves once `main` carries 1.7.23. The `hono` alerts close when #184 and #185 merge.
- Until the upgrade merges, every pull request in this run fails the audit check, the docs mirror of this spec included. That is why the upgrade merges first.
- Evidence gathered on 2026-11-14:
  - Dependabot's run logs from 2026-11-03 (`all_versions_ignored`).
  - The shipped packages of `better-auth` and `auth` at 1.7.1, 1.7.7 and 1.7.23.
  - The upstream 1.7 upgrade guide and database docs (v1.7.15, read through Context7).
  - The GitHub advisory pages.
