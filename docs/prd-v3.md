# PRD v3 — Required-field asterisk markers

Version 3.0 — 2026-08-27. Follows `docs/prd-v2.md` (v2.0, delivered by spec #81). This document is
the repository copy of PRD issue #100. Spec and execution map issue references are added here as
those stages create them. The domain glossary lives in `docs/CONTEXT.md`.
## Problem statement

Nothing on any form tells the user which fields are mandatory before they submit. The Add asset form is the worst case â€” six of its eighteen fields are required, and the only way to discover which is to submit an incomplete form and read the red validation messages. The same gap exists on every other data-entry form: loan check-out, the four master-data forms, user administration, and sign-in. Requiredness is enforced correctly server-side and announced correctly to assistive technology; it is simply invisible to sighted users until after a failed attempt.

Who has the problem: signed-in staff and admins entering data (assets, loans, master data, users), and anyone on the sign-in form.

## Goals

1. Every mandatory field's label carries a visible asterisk before the first submission attempt.
2. The convention is identical on every data-entry form in the app â€” one rule, learned once.
3. A short legend on each form states what the asterisk means, in the user's language.
4. The marker is purely visual: assistive technology continues to hear the required state exactly as it does today, with no double announcement and never the word "asterisk".
5. Accessibility and localisation bars hold: AA contrast in both themes, Indonesian and English complete together.

## Non-goals

- No change to validation behaviour, error display, submission flow, or any data contract.
- No marking of optional fields â€” no "(optional)" tags.
- No browser-native validation; the server remains the single validation authority.

## Decisions and trade-offs

1. **A text asterisk character, not an icon.** It scales with the label's typography, needs no asset, and is the universal convention. An SVG icon buys nothing over the character.
2. **Mark required fields only.** The inverse convention (tagging optional fields) was considered and rejected: most of this app's forms are majority-required or entirely required, so optional-tagging would either be noise or mark nothing.
3. **The asterisk is red â€” the same red the validation messages already use.** That colour already means "requirement" in this app, and its contrast is already verified to AA in both themes.
4. **One legend line per form, above the fields** â€” Indonesian "* wajib diisi", English "* Required field". WCAG expects the meaning of a symbol to be stated. Once per form, not once per section, to avoid repetition on the multi-section asset form.
5. **Forms where every field is required are marked all the same.** Consistency was chosen over minimalism: if the convention were skipped where nothing is optional, an unmarked field elsewhere would become ambiguous ("optional, or convention skipped?").
6. **A required field that is always pre-filled with a valid default, and can never be submitted empty, carries no asterisk.** The marker means "act, or submission fails"; marking a field that cannot fail dilutes the signal. Today this exempts exactly two selects: the asset status (defaults to Active) and the new user's role (defaults to Staff).
7. **The marker is hidden from assistive technology.** Required state is already conveyed programmatically on every field; adding a spoken "star" would double-announce and degrade the experience the app already gets right.
8. **The legend text lives in one shared localisation namespace, not duplicated per page.** The app already established that precedent for cross-cutting table controls; nine duplicated copies of the same string drift apart.

## Out of scope

- The label-sheet offset form (a display filter, not data entry â€” no field there is "required" in the user-action sense).
- The loan return form (no typed fields).
- The optional first-photo section on asset creation (already explicitly labelled optional in prose).
- Any redesign of form layout, field order, or validation messages.

## Success criteria

1. On every data-entry form, a red asterisk appears on exactly the fields whose emptiness would fail submission and require user action; the two pre-filled defaults are unmarked; optional fields are unmarked.
2. Each marked form shows the localised legend exactly once.
3. A screen reader announces each required field's required state exactly once, and never announces the asterisk itself.
4. The asterisk meets 4.5:1 contrast against the form background in both light and dark themes.
5. Indonesian and English message catalogues are complete in the same change.
6. The repository quality gate â€” lint, typecheck, tests, build, and the SonarQube Cloud quality gate â€” passes.
