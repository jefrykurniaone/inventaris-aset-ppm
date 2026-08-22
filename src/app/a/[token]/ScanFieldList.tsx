import type { ReactNode } from "react";

/**
 * The one presentational primitive the scan page's field groups share: a
 * `<dl>` under a heading, with a localised "not set" standing in for a null.
 *
 * Kept apart from the groups themselves so `ScanPublicFields` and
 * `ScanRestrictedFields` cannot drift into two different-looking lists, and so
 * neither file has to re-declare it inside its own render (S6478).
 */

export function ScanField({
  label,
  value,
}: Readonly<{ label: string; value: string }>) {
  return (
    <div>
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="break-words">{value}</dd>
    </div>
  );
}

export function ScanFieldGroup({
  headingId,
  heading,
  note,
  children,
}: Readonly<{
  headingId: string;
  heading: string;
  note?: string;
  children: ReactNode;
}>) {
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h2 id={headingId} className="text-lg font-semibold">
        {heading}
      </h2>
      {note ? <p className="text-muted-foreground text-sm">{note}</p> : null}
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        {children}
      </dl>
    </section>
  );
}

/** `null` reads as the localised "not set" everywhere on this page. */
export function orNotSet(value: string | null, notSetText: string): string {
  return value ?? notSetText;
}
