interface FieldErrorProps {
  readonly id?: string;
  readonly message?: string;
}

/**
 * One field's inline validation error, linked to its input via
 * `aria-describedby` (the caller passes the same `id` to both). Text colour
 * is `--destructive-text` (issue #37) — the token asserted at 4.5:1 against
 * `--background` in both themes, distinct from the `--destructive` surface
 * token a filled button/badge uses.
 */
export function FieldError({ id, message }: Readonly<FieldErrorProps>) {
  if (!message) {
    return null;
  }

  return (
    <p
      id={id}
      className="border-destructive text-destructive-text border-l-2 pl-2 text-sm"
    >
      {message}
    </p>
  );
}
