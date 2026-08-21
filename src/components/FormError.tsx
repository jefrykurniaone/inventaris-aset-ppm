interface FormErrorProps {
  readonly message: string | null;
}

/**
 * A form-level error, announced to assistive technology via `aria-live`.
 * Shared by the sign-in form and the admin "create user" form, so the same
 * markup and announcement behaviour do not drift between the two.
 *
 * Text colour is `--destructive-text` (issue #37), asserted at 4.5:1
 * against `--background` in both themes. Before #37 this rendered in
 * `--foreground` instead: `--destructive` itself measures only 3.69:1 as
 * text on the dark theme's `--background`, short of the 4.5:1 SC 1.4.3
 * requires, and `--destructive-text` did not yet exist to fill that gap.
 * The border stays `border-destructive` — a non-text use, needing only 3:1,
 * which the surface token clears in both themes.
 */
export function FormError({ message }: Readonly<FormErrorProps>) {
  if (!message) {
    return null;
  }

  return (
    <p
      role="alert"
      aria-live="polite"
      className="border-destructive text-destructive-text border-l-2 pl-2 text-sm"
    >
      {message}
    </p>
  );
}
