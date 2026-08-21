interface FieldErrorProps {
  readonly id?: string;
  readonly message?: string;
}

/**
 * One field's inline validation error, linked to its input via
 * `aria-describedby` (the caller passes the same `id` to both). See
 * `src/components/FormError.tsx` for why the colour is a border, not text.
 */
export function FieldError({ id, message }: Readonly<FieldErrorProps>) {
  if (!message) {
    return null;
  }

  return (
    <p
      id={id}
      className="border-destructive text-foreground border-l-2 pl-2 text-sm"
    >
      {message}
    </p>
  );
}
