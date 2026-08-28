# Spec v1 - Dashboard attention rework: narrowed attention rule and missing-photo card

> Tracker: Spec [#138](https://github.com/jefrykurniaone/inventaris-aset-ppm/issues/138) · Execution map [#142](https://github.com/jefrykurniaone/inventaris-aset-ppm/issues/142) · Run label `run:attention-rework`.

## Problem Statement

The dashboard's "Requires attention" card (PRD FR-9.1) counts assets matching a three-way OR: status `in_repair`, condition `poor`, or no photo attached. In practice the photo clause dominates the figure — with the current seed data, 45 of the 50 counted assets qualify only because they lack a photo — so a card that reads as "assets with physical problems" is really reporting "assets nobody has photographed yet". The two concerns need different people and different actions, and mixing them makes the number unactionable.

Two further gaps: assets with status `lost` are not counted as requiring attention even though an unresolved loss demands action more urgently than an asset already in repair; and there is no dashboard surface at all for the photo-completeness problem, which matters in its own right because a record without a photo doesn't show what the asset looks like.

## Solution

Split the compound figure into two purpose-built cards:

- **Requires attention** — assets with status `in_repair` or `lost`, or condition `poor`. The card moves out of the summary grid down to the row occupied by the overdue-loans card, forming a two-column "needs action" row: overdue loans beside requires-attention, both styled the same (title, large count, description line, link to the pre-filtered list). This row always renders, even on an empty register, because a true zero is useful there.
- **Missing photo** — live assets with no photo attached. A compact stat card in the summary grid, taking the slot the attention card vacates, linking to the asset list filtered to photo-less assets. It follows the summary grid's existing behaviour of hiding when the register is empty.

Both cards are visible to admin and staff. The asset-list filters stay in lockstep with the cards: the existing `attention=1` filter narrows to the new attention rule, and a new `noPhoto=1` filter backs the missing-photo card. PRD FR-9.1 is rewritten in the same change so the document keeps describing the dashboard that exists.

## User Stories

1. As an admin, I want the requires-attention count to include only assets in repair, lost, or in poor condition, so that the figure reflects physical and custody problems someone must act on.
2. As an admin, I want lost assets counted as requiring attention, so that an unresolved loss stays visible until it is investigated or written off.
3. As an admin, I want assets that merely lack a photo excluded from the requires-attention count, so that data-hygiene work does not drown out physical problems.
4. As a staff member, I want a dashboard card counting assets that have no photo, so that I know how much photographing work remains.
5. As a staff member, I want to click the missing-photo card and land on the asset list showing exactly those assets, so that I can work through the backlog without building a filter by hand.
6. As a user, I want to click the requires-attention card and land on the asset list filtered to the same rule the count used, so that the number and the list never disagree.
7. As a user, I want the requires-attention card displayed beside the overdue-loans card, so that everything demanding action reads as one group.
8. As a user, I want the requires-attention and overdue-loans cards to render even when the register is empty, so that a zero there is shown as a true figure rather than hidden.
9. As a user, I want the missing-photo card to appear and disappear with the other summary cards, so that an empty register shows the existing single empty-state message instead of a grid of meaningless zeros.
10. As a staff member, I want both new figures visible without admin rights, so that day-to-day upkeep does not depend on an admin signing in.
11. As an Indonesian-locale user, I want the new card and all its text in Indonesian ("Belum ada foto"), so that the dashboard stays fully localised.
12. As an English-locale user, I want the same card labelled "Missing photo", so that both locales ship complete together.
13. As a user exporting the asset list to CSV, I want the export to honour the attention and missing-photo filters exactly as the list does, so that the file matches what I saw on screen.
14. As a keyboard or screen-reader user, I want both cards reachable and announced like the existing cards, so that the dashboard stays WCAG AA conformant.
15. As a maintainer, I want the attention rule declared in one place shared by the dashboard count and the list filter, so that the card and the filtered list cannot drift apart.
16. As a maintainer, I want PRD FR-9.1 updated in the same pull request, so that the requirements document never describes a card that no longer exists.

## Implementation Decisions

- The requiring-attention rule becomes: status is `in_repair` or `lost`, OR condition is `poor`, over live (non-deleted) assets. The photo clause is removed from it. The rule stays declared once in the existing attention-rule module, which both the dashboard count and the asset list's `attention` filter keep reading, preserving the existing predicate-versus-query parity test design.
- A missing-photo rule is declared in the same single-declaration pattern (its own small module): a live asset with zero related photos, expressed as a Prisma relation filter so the check runs in SQL. It is shared by the dashboard count, the asset list's new `noPhoto` filter, and the CSV export.
- The asset list's URL parameter contract: `attention=1` keeps its name with the narrowed semantics; `noPhoto=1` is added, validated the same forgiving way (`1` means on, anything else means off, never throwing). Both flow through the list page and the CSV export route. Neither gets a visible filter control in the list UI — like `attention` today, they are reached from the dashboard cards.
- Both new counts are computed inside the existing dashboard aggregate batch (one `Promise.all` with the other metrics), not as per-card queries — the same serialised-round-trip lesson already recorded on the overdue-loans card (issue #83).
- The requires-attention card is restyled to the overdue-loans card's shape — heading, large count, description line, link — and the two sit in a responsive two-column row. This row renders unconditionally.
- The missing-photo card is a compact stat card (title plus figure, whole card is the link) occupying the summary-grid slot the attention card vacates. The grid keeps four cards for an admin and three for staff, and keeps hiding as a unit when the register is empty.
- The dashboard loading skeleton is updated to mirror the new arrangement.
- Card labels: English "Missing photo", Indonesian "Belum ada foto". Every new string goes through next-intl with both locale files completed in the same pull request.
- No new authorisation split: both cards render for admin and staff; neither figure carries restricted data.
- PRD FR-9.1 is rewritten in the same pull request to describe the narrowed attention rule, the card's new position and shape, and the new missing-photo summary card.

## Testing Decisions

- Tests target external behaviour at the rule seams, following the codebase's existing pattern: the attention module's parity test (a pure predicate stated independently of the Prisma clause, checked against the query shape) is updated for the new rule, and the missing-photo module gets the same treatment.
- The asset-list query-building tests are extended: `noPhoto` produces the missing-photo clause, narrowed `attention` produces the new clause, and each composes correctly with search and the other filters.
- The URL-parameter schema tests are extended for `noPhoto` parsing (accepts `1`, rejects everything else silently).
- Dashboard metrics shaping tests follow the existing co-located unit-test pattern.
- No new Playwright path: the existing smoke path already covers dashboard render, and the change introduces no new interactive flow.

## Out of Scope

- Any dedicated surface for poor-condition assets beyond their inclusion in the attention count (no condition-breakdown card).
- Changes to the overdue-loans rule, card, or the loans list.
- Visible filter controls in the asset list UI for `attention` or `noPhoto` (both remain URL-reached, as `attention` is today).
- Seed data redesign — the seeded counts shift naturally with the new rules.
- Any reporting/export surface beyond the existing CSV export honouring the two filters.

## Further Notes

The current count of 50 on the card is correct under the old rule and fully explained by seed data: 60 seeded assets, 45 lacking photos, plus 5 photographed assets that are in repair or in poor condition. Under the new rules the same seed yields a requires-attention count of `status in_repair or lost, or condition poor` assets and a missing-photo count of 45, which makes the split visible immediately in development.

## Tickets

- [#139](https://github.com/jefrykurniaone/inventaris-aset-ppm/issues/139) — narrow requires-attention rule to in_repair, lost, poor (wave 1).
- [#140](https://github.com/jefrykurniaone/inventaris-aset-ppm/issues/140) — missing-photo rule, `noPhoto=1` asset-list filter, dashboard count (wave 1).
- [#141](https://github.com/jefrykurniaone/inventaris-aset-ppm/issues/141) — dashboard layout swap, missing-photo summary card, PRD FR-9.1 rewrite (wave 2, blocked by #139 and #140).
