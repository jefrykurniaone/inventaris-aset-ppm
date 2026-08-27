# PRD v2 — Production hardening and table UX

Version 2.0 — 2026-08-26. Follows `docs/prd.md` (v1.0, delivered by spec #20). This document is
the repository copy of spec issue #81; the execution map is issue #91; the tickets are #82-#90,
sub-issues of #81. The domain glossary lives in `docs/CONTEXT.md`.
## Problem Statement

The prototype is deployed and usable, but a first real session against the production URL surfaced five defects and a set of usability gaps:

- Every navigation takes roughly five seconds, and nothing on screen indicates that the app is working rather than stuck. The browser tab spinner never runs because App Router navigations are client-side fetches, so the app freezes silently.
- Creating an asset cannot include a photo. The user must save the asset, then open it for editing, just to upload the first photo.
- Deactivating a user records no reason. An admin cannot later see why an account was disabled.
- After signing out and signing in as a different user, the dashboard still shows the previous user's name and menu until a hard refresh. One user seeing another user's view is the worst class of defect in the app.
- Lists are tuned for lookup, not recency: a staff member who just created an asset cannot see it at the top of any list, page size is only adjustable on the asset list, most tables cannot be sorted, and long dropdowns cannot be searched.

There is also no evidence about performance: no latency numbers exist anywhere in the repository, and no security review has been run against the deployed app.

## Solution

Harden the deployed prototype in three strokes:

1. **Fix the five defects** — refresh the router cache on sign-in/sign-out, move the Vercel functions to the same region as the database and cut redundant/serial queries, draw loading feedback on every navigation, accept a photo during asset creation, and require a reason when deactivating a user.
2. **Bring every list to the same standard** — newest-first by default where recency is what the user wants, urgency-first where it is not (loans), clickable column-header sorting on a curated set of columns, a page-size selector on every table, and searchable comboboxes on the dropdowns that grow with real data.
3. **Prove it** — a scripted Lighthouse pass with pass/fail budgets recorded in the repository, and a focused penetration review (authorization audit plus an OWASP ZAP baseline scan) once the fixes have merged.

## User Stories

1. As a staff member, I want visible loading feedback on every navigation, so that I can tell the app is working rather than frozen.
2. As a staff member, I want the heavy pages (dashboard, asset list) to show a skeleton while they load, so that the wait feels shorter and the layout does not jump.
3. As a staff member, I want page navigation to complete in a reasonable time, so that routine work is not dominated by waiting.
4. As a staff member, I want to attach a photo while creating an asset, so that I do not have to save first and then edit just to upload one.
5. As a staff member, I want a failed photo upload during creation to keep the asset I just created, so that I can retry the upload without re-entering the form.
6. As an admin, I want to be required to enter a reason when deactivating a user, so that the decision is documented at the moment it is made.
7. As an admin, I want to see the deactivation reason in the users table, so that I can review why an account is disabled without digging.
8. As an admin, I want deactivation and reactivation recorded in the activity log with the reason, so that the history survives even after the account is reactivated.
9. As a user who signs out and back in under a different account, I want the app to show the new account's name, menu, and data immediately, so that I never see a stale view belonging to someone else.
10. As a staff member, I want the asset list to show the most recently created assets first by default, so that what I just added is immediately visible.
11. As a staff member, I want the loans list to keep showing the most urgent (due-soonest) loans first, so that overdue chasing stays easy.
12. As an admin, I want the users list ordered newest-first by default, so that recently added accounts are on top.
13. As a staff member, I want to sort any major table by clicking a column header, toggling between ascending and descending, so that I can order data the way my current task needs.
14. As a staff member, I want the current sort column and direction to be visible in the header, so that I always know how the table is ordered.
15. As a staff member, I want to choose how many rows each table shows per page, so that I can trade scrolling against paging myself.
16. As a staff member, I want my chosen page size and sort to live in the URL, so that a link I share shows the same view to a colleague.
17. As an admin, I want the master-data tables (rooms, categories, buildings, funding sources) paginated with the same page-size control, so that they stay usable as data grows.
18. As a staff member, I want the room and category pickers to be searchable by typing, so that selection stays fast when the real dataset has many entries.
19. As a staff member, I want the searchable pickers fully keyboard-operable, so that they meet the same accessibility bar as the rest of the app.
20. As the project owner, I want measured page-load numbers with explicit pass/fail budgets recorded in the repository, so that "fast enough" is a fact rather than an impression.
21. As the project owner, I want the measurement taken before and after the performance fix, so that the fix's effect is proven rather than assumed.
22. As the project owner, I want an authorization audit of every mutation and public query plus an automated baseline scan of the deployed app, so that the public QR surface and the role split are verified against the OWASP Top 10.
23. As a public visitor scanning a QR label, I want the public asset page to keep loading quickly and expose no restricted data, so that the public surface stays both fast and safe.

## Implementation Decisions

- **Stale view after user switch**: the root cause is the Next.js client-side Router Cache serving the previous user's RSC payload; both the sign-in and sign-out flows navigate with a client router push and never refresh. The fix is to refresh the router cache at both transitions. No cookie handling changes.
- **Slowness**: the database lives in Supabase `ap-southeast-1` (Singapore) while the Vercel functions run in the default US-East region, so every query crosses the Pacific. Pin the Vercel function region to Singapore (`sin1`), verified against current Vercel documentation for the Hobby plan before applying. Additionally: memoize the per-request session lookup (it currently runs at least twice per request, once in the layout and once in the page) with React's request-scoped cache, and run the dashboard's independent aggregate queries concurrently instead of serially.
- **Loading feedback**: a global top progress bar tied to route transitions catches every navigation; route-level loading skeletons are added for the two heaviest pages (dashboard and asset list); the asset filter submit button gets the same pending state the other forms already have. Browser-native spinners are unavailable by construction for App Router navigations, so the app draws all its own feedback.
- **Photo on create**: the storage object path is keyed by asset id, so no upload can start before the row exists. The create form accepts a photo file; the create action returns the new asset's id instead of redirecting; the client then runs the existing photo upload pipeline (compress, signed upload, attach) and navigates on completion. On upload failure the asset survives, a localized error is shown, and the photo can be added from the edit page. The storage seam and the signed direct-upload flow are unchanged.
- **Deactivation reason**: "deactivate" remains the product term (Better Auth ban underneath — see the domain glossary). The deactivate control opens a dialog with a required reason field, stored in the existing ban-reason column that the schema already carries but nothing writes. The reason is shown in the admin users table, admins only. Reactivation clears the stored reason; both actions write an activity log entry carrying the reason so history survives. Reason text is never exposed on any non-admin surface.
- **List ordering defaults**: newest-first (creation time, descending) becomes the default for the asset list, the users list, and the per-asset activity timeline. The loans list keeps due-soonest-first because its job is chasing due dates. Master-data lists keep code order as their default. Every default is overridable by the new column sorting.
- **Column sorting**: clickable column headers with a visible direction indicator replace the current sort dropdowns, on a curated set of columns per table (identity, name, year/date, created time — never photos or action columns). Sort state stays in the URL and stays whitelist-validated server-side, exactly as the existing asset-list sort keys are.
- **Page size**: the existing preset scale (10 / 20 / 50 / 100) is kept and the default becomes 10 everywhere. The same URL-parameter mechanism and server-side clamping used by the asset list is extended to the loans list and all admin tables. Admin master-data tables gain pagination now.
- **Searchable dropdowns**: the room and category pickers (in both forms and list filters) become searchable comboboxes; small fixed enumerations (status, condition, role, building, funding source) stay native selects. The combobox is built on the cmdk library (new dependency — licence, maintenance, and CVE check in the pull request that adds it) with full keyboard operation and WCAG AA compliance.
- **Performance evidence**: a scripted Lighthouse run against the production deployment measures the dashboard, the asset list, and the public QR page. Budgets: LCP at most 2.5 s, TTFB at most 800 ms. The orchestrator captures the baseline before the region fix deploys; the results document records both baseline and post-fix numbers.
- **Security review**: a manual authorization audit (every server action's permission check, the public/restricted field split at the query layer, QR token unpredictability and enumeration resistance, sign-in rate limiting) plus an OWASP ZAP baseline scan of the deployed app, run only after the defect fixes have merged. Findings become their own issues; the review itself changes no code.
- **Dropped**: load/stress testing is explicitly not done — the production database runs on the Supabase free plan and a load test would exhaust the connection pool for real users.

## Testing Decisions

- Tests assert external behaviour, never implementation: a list's rendered order, a URL's effect on a query, a dialog refusing to submit without a reason — not which function was called.
- The list-query builders (sort whitelisting, page-window clamping, default ordering) are covered by co-located Vitest unit tests, following the dense existing pattern beside the asset-list and loan-list query builders.
- The deactivation flow's reason requirement and the activity-log writes are covered at the server-action level with Vitest, following the existing action test pattern.
- The photo-on-create path extends the existing Playwright smoke test, which already performs a real sign-in, creates an asset, and uploads a photo — the smoke path moves the upload into the create step.
- The combobox's keyboard operation is covered by a Playwright interaction test, since keyboard behaviour is exactly what unit tests cannot see.
- Performance and security work produce evidence documents, not test files; their pass/fail criteria live in this spec.

## Out of Scope

- Load testing or stress testing of any kind, in any environment (free-plan database).
- Supabase Auth, a storage driver switch, or any change to the three architectural seams.
- Widening or upgrading the pinned versions of prisma, @prisma/client, or better-auth.
- A global activity-log page (activity stays per-asset).
- Server-persisted user preferences for page size or sort (URL state only).
- Virtualized or infinite-scrolling tables.
- Any new deactivation-related schema column — the existing ban fields are sufficient.
- Fixing findings from the penetration review inside the review ticket — each finding becomes its own issue.

## Further Notes

- The domain glossary (`docs/CONTEXT.md`) fixes the vocabulary: "deactivate", not "ban", in every user-facing and code-facing name; the underlying library call is the implementation detail.
- The five defects and the usability gaps were found in a single manual session against the production URL on 2026-08-26; there is no automated monitoring yet, which is worth its own conversation later.
- Page-size default changes from 20 to 10 on the asset list; existing shared URLs without an explicit pageSize parameter will render 10 rows instead of 20, which is accepted.

