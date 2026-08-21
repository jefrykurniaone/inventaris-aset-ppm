# SonarQube Cloud analysis

How static analysis runs on this repository, and the four things about it that are not obvious.

Configuration lives in [`sonar-project.properties`](../sonar-project.properties) and in the `sonar`
job of [`.github/workflows/ci.yml`](../.github/workflows/ci.yml).

| | |
|---|---|
| Organization | `jefry-kurniawan` |
| Project key | `jefrykurniaone_inventaris-aset-ppm` |
| Dashboard | <https://sonarcloud.io/dashboard?id=jefrykurniaone_inventaris-aset-ppm> |
| Action | `SonarSource/sonarqube-scan-action`, pinned to the commit for `v8.2.1` |
| Secret | `SONAR_TOKEN`, in the repository's Actions secrets |

## `SONAR_TOKEN` does not go in `.env.local`

**GitHub → repository → Settings → Secrets and variables → Actions → New repository secret**, named
exactly `SONAR_TOKEN`. Nowhere else. Generate the value at SonarQube Cloud under My Account →
Security, or from the project's own Analysis Method page.

`.env.local` is the natural guess and it is wrong. Everything in that file — `DATABASE_URL`,
`BETTER_AUTH_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `SEED_ADMIN_PASSWORD` — is read by the application
or by a script somebody runs locally. `SONAR_TOKEN` is read by a GitHub Actions runner, which never
sees your machine, and `.env.local` is git-ignored so it could not reach one even if you wanted it to.
Different consumer, different store.

Never committed, never in `.env.example`, never prefixed `NEXT_PUBLIC_`, and never pasted into an
issue, a pull request body, or a chat transcript. If it leaks, revoke it in SonarQube Cloud and
generate a new one — it grants analysis access to the organization's projects.

Note the asymmetry against the deployment variables, because it is the part that catches people out:
`DATABASE_URL` and the Supabase keys will need to exist in **two** places once the app is deployed —
`.env.local` for development and Vercel's environment variables for the running deployment — while
`SONAR_TOKEN` only ever exists in GitHub Actions. See #17 for the cutover.

## Automatic Analysis must stay off

**This is the one that will waste an afternoon.** SonarQube Cloud enables Automatic Analysis by
default on a new project, and it **cannot coexist with CI-based analysis** — with both on, the scan
step fails with a message about the project already being analysed automatically. It is a project
setting in the web interface, so nothing in this repository can express or enforce it.

If the `Analyse` step starts failing for no reason anyone can see in the diff, check that setting
first. Automatic Analysis ran on this project until CI-based analysis replaced it, so a future
"reset the project" would turn it back on.

CI-based analysis was chosen over it for two reasons: Automatic Analysis cannot read a coverage
report, and it cannot use a quality profile this repository controls.

## Coverage exclusions mirror `vitest.config.mts` and must stay in step

`vitest.config.mts` instruments `src/lib/**` **only**, deliberately, with its reasoning recorded in a
comment there. Pages, components, server actions and scripts produce no coverage data at all.

Sonar cannot distinguish "not instrumented" from "not covered". Left alone, the default gate — which
wants roughly 80% coverage on new code — would count every new page and component in every future
pull request as uncovered, and fail on work that is behaving exactly as designed. That is the fastest
way to teach everyone to ignore a red check.

`sonar.coverage.exclusions` therefore lists what Vitest does not instrument, including
`src/lib/db.ts`, `src/lib/auth.ts` and `src/lib/auth-client.ts`, which that file excludes too.

**If you change `coverage.include` or `coverage.exclude` in `vitest.config.mts`, change this list in
the same pull request.** Deleting the line to "fix" a coverage number will break the gate for
everyone else instead.

Widening instrumentation to the whole application is a separate decision, and `vitest.config.mts`
says why: glob thresholds do not inherit a global one in Vitest, and none is set.

## The editor and the server do not report the same things

Neither analyser is a superset of the other, so "zero SonarQube issues" means whichever one you
consulted. Observed on this project:

- **Server only — workflow YAML.** Every `githubactions:*` rule. SonarLint in VS Code does not
  analyse workflow files, so nothing found locally will ever surface them. This is why
  `sonar.sources` is `.` rather than a list of source directories: a list that forgets `.github`
  silently drops those rules and looks like an improvement.
- **Server only — TypeScript.** `typescript:S8786` on `src/lib/globals-css-tokens.ts`'s
  `CUSTOM_PROPERTY` regex. SonarLint flagged a different regex in the same file and not that one.
- **Editor only.** The twenty findings across waves 0 and 1 — `S6551`, `S6759`, `S6644`, `S6754`,
  `S5976`, `S7750`, `S6582` — none of which the server reported. All fixed in #40 and #37.

**CI is now the authority.** The editor extension is a convenience and is no longer part of the
completion gate. It was never verifiable for a sub-agent anyway: `getDiagnostics` returns an empty
array both for a clean file and for a file the editor has never opened, which are not the same thing.

## The scan is skipped, not failed, without a token

`HAS_SONAR_TOKEN` is derived from the secret in a job-level `env` expression — which may read
`secrets`, where a step-level `if` may not — so the workflow stays green for anyone without access to
the secret, and emits a workflow warning saying the commit was not analysed. A fork's pull request
will always take this path, because secrets are not exposed to workflows triggered from forks.

Two consequences worth knowing: a green CI run is **not** proof that analysis happened, so check the
step, and the token never enters the environment of the `verify` job. That separation is why the
`sonar` job downloads `coverage/lcov.info` as an artefact instead of re-running the test suite:
`verify` runs `npm ci`, which runs third-party install scripts, and a token in that job's environment
would be readable by any of them.

## Setting it up again from scratch

1. Create the project on SonarQube Cloud and bind it to the GitHub repository.
2. **Turn Automatic Analysis off.**
3. Generate a token and add it as the `SONAR_TOKEN` Actions secret.
4. Confirm `sonar.organization` and `sonar.projectKey` in `sonar-project.properties` match the new
   project — the project key is visible in the dashboard URL.
