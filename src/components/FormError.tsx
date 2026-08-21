interface FormErrorProps {
  readonly message: string | null;
}

/**
 * A form-level error, announced to assistive technology via `aria-live`.
 * Shared by the sign-in form and the admin "create user" form, so the same
 * markup and announcement behaviour do not drift between the two.
 *
 * Colour comes from `--destructive` as a **border**, not as text colour:
 * `color-contrast.test.ts` only asserts `--destructive` against
 * `--destructive-foreground` (a filled surface), and in the dark theme
 * `--destructive` directly on `--background` measures 3.69:1 — short of
 * WCAG AA's 4.5:1 text minimum, though comfortably past the 3:1 a non-text
 * indicator needs. The message itself is `--foreground` on `--background`,
 * a pairing `color-contrast.test.ts` does assert.
 */
export function FormError({ message }: Readonly<FormErrorProps>) {
  if (!message) {
    return null;
  }

  return (
    <p
      role="alert"
      aria-live="polite"
      className="border-destructive text-foreground border-l-2 pl-2 text-sm"
    >
      {message}
    </p>
  );
}
