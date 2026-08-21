"use client";

import { useLocale } from "next-intl";
import { useId, useTransition, type ChangeEvent } from "react";

import type { Locale } from "@/i18n/config";
import { setLocale } from "@/i18n/set-locale";
import { cn } from "@/lib/utils";

interface LocaleOption {
  readonly value: Locale;
  readonly label: string;
}

interface LocaleSwitcherSelectProps {
  readonly label: string;
  readonly options: readonly LocaleOption[];
}

/**
 * The interactive half of the locale switcher. Split from `LocaleSwitcher`
 * so that only this part — not the translated option labels — ships as
 * client JavaScript (see `src/components/LocaleSwitcher.tsx`).
 *
 * A native `<select>` bound to a `<label>` is keyboard-operable and
 * screen-reader-labelled without any ARIA role. Selecting an option calls
 * the `setLocale` server action directly; React 19's `startTransition`
 * tracks the action (including the automatic Server Component refresh that
 * follows it) as pending, so the control disables itself and announces
 * `aria-busy` for the duration rather than allowing a second, overlapping
 * change.
 */
export function LocaleSwitcherSelect({
  label,
  options,
}: Readonly<LocaleSwitcherSelectProps>) {
  const locale = useLocale();
  const selectId = useId();
  const [isPending, startTransition] = useTransition();

  function handleChange(event: ChangeEvent<HTMLSelectElement>) {
    const nextLocale = event.target.value;
    if (nextLocale === locale) {
      return;
    }
    // `setLocale` re-validates this against `localeSchema` server-side; the
    // `<option>` values below are the only values this control can ever
    // send, so a validation failure here would mean the schema and the
    // rendered options have drifted apart, not a hostile request.
    startTransition(async () => {
      await setLocale(nextLocale);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor={selectId} className="text-muted-foreground text-sm">
        {label}
      </label>
      <select
        id={selectId}
        value={locale}
        disabled={isPending}
        aria-busy={isPending}
        onChange={handleChange}
        className={cn(
          "border-border bg-background text-foreground rounded-md border px-2 py-1 text-sm",
          "focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2",
          "disabled:opacity-70",
        )}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
