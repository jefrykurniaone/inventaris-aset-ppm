import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * A styled native `<select>`, not a Radix `Select` — this project has no
 * Radix select primitive yet, and a plain `<select>` is already the pattern
 * `CreateUserForm`'s role picker uses (its own inline `SELECT_CLASS`
 * constant). Added here as the one place that class list lives, because
 * Rooms need the same control three times: the create form's building
 * picker, the edit form's building picker, and the list's building filter.
 */
function Select({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="select"
      className={cn(
        "h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
        className,
      )}
      {...props}
    />
  );
}

export { Select };
