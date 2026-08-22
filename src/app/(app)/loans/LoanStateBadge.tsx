import { Badge } from "@/components/ui/badge";
import type { LoanState } from "@/lib/loan-transitions";

import { LOAN_STATE_LABEL_KEYS, type LoansTranslate } from "./loan-field-specs";

/**
 * A loan's state, as a badge (PRD FR-6.4's "clear visual indicator").
 *
 * The indicator never rests on colour. Each badge carries its state as a
 * localised word — "Overdue" / "Terlambat" — and the overdue one additionally
 * carries a warning glyph, so the distinction survives a monochrome display,
 * a colour-vision deficiency, and a screen reader alike (WCAG 1.4.1). The
 * colour is the third signal, not the only one.
 *
 * The glyph is `aria-hidden`, because the word beside it already says the same
 * thing and announcing both would read as "warning overdue".
 */

const STATE_VARIANTS: Readonly<
  Record<LoanState, "secondary" | "destructive" | "outline">
> = {
  active: "secondary",
  overdue: "destructive",
  returned: "outline",
};

/** A filled warning triangle, inline rather than from an icon package: this is
 * the only icon the loan register needs, and a dependency for one path is not
 * worth its bundle cost or its maintenance surface. */
function OverdueGlyph() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="size-3"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M8 1.5a1 1 0 0 1 .87.5l6 10.5A1 1 0 0 1 14 14H2a1 1 0 0 1-.87-1.5l6-10.5A1 1 0 0 1 8 1.5Zm0 3.75a.75.75 0 0 0-.75.75v3a.75.75 0 0 0 1.5 0v-3A.75.75 0 0 0 8 5.25Zm0 6.5a.9.9 0 1 0 0-1.8.9.9 0 0 0 0 1.8Z" />
    </svg>
  );
}

interface LoanStateBadgeProps {
  readonly state: LoanState;
  readonly t: LoansTranslate;
}

export function LoanStateBadge({ state, t }: Readonly<LoanStateBadgeProps>) {
  return (
    <Badge variant={STATE_VARIANTS[state]}>
      {state === "overdue" ? <OverdueGlyph /> : null}
      {t(LOAN_STATE_LABEL_KEYS[state])}
    </Badge>
  );
}
