"use client";

/**
 * Generated in the shape `npx shadcn add popover` would produce, then edited
 * the same way `dialog.tsx` and `alert-dialog.tsx` already are: every prop
 * type is wrapped in `Readonly<>` for SonarQube `typescript:S6759`, which the
 * generator does not do. Re-running the generator will overwrite these
 * wrappers — re-apply them.
 *
 * Added for the searchable room and category pickers (issue #88), which need a
 * surface that opens under a trigger, closes on Escape and on an outside
 * click, and returns focus to the trigger afterwards. `Dialog` is the wrong
 * primitive for that: it is modal, it dims the page behind it, and a filter
 * control that blacks out the list it filters is not a filter control.
 *
 * The content is deliberately non-modal (Radix's default): the surrounding
 * page keeps its scroll and the rest of the form stays reachable by Tab.
 */

import * as React from "react";
import { Popover as PopoverPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

/** Distance in pixels between the trigger and the panel. */
const SIDE_OFFSET = 4;

function Popover({
  ...props
}: Readonly<React.ComponentProps<typeof PopoverPrimitive.Root>>) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

function PopoverTrigger({
  ...props
}: Readonly<React.ComponentProps<typeof PopoverPrimitive.Trigger>>) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

function PopoverContent({
  className,
  align = "start",
  sideOffset = SIDE_OFFSET,
  ...props
}: Readonly<React.ComponentProps<typeof PopoverPrimitive.Content>>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-50 w-[var(--radix-popover-trigger-width)] min-w-48 origin-[var(--radix-popover-content-transform-origin)] rounded-md border bg-popover text-popover-foreground shadow-md outline-none",
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}

export { Popover, PopoverContent, PopoverTrigger };
