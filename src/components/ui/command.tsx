"use client";

/**
 * Generated in the shape `npx shadcn add command` would produce — a thin
 * styling layer over `cmdk` — then edited the same way the other primitives in
 * this folder are: every prop type is wrapped in `Readonly<>` for SonarQube
 * `typescript:S6759`, which the generator does not do, and the icons are the
 * same text glyphs the rest of this project uses rather than a new icon
 * dependency. Re-running the generator will overwrite both — re-apply them.
 *
 * `cmdk` owns the behaviour that makes this accessible, and none of it is
 * re-implemented here: the input carries `role="combobox"` with
 * `aria-expanded`, `aria-controls` and `aria-activedescendant`, the list is a
 * `role="listbox"`, each item a `role="option"`, and the arrow keys, Home/End
 * and Enter move and choose between them. Escape is Radix Popover's, from
 * `popover.tsx`.
 */

import * as React from "react";
import { Command as CommandPrimitive } from "cmdk";

import { cn } from "@/lib/utils";

function Command({
  className,
  ...props
}: Readonly<React.ComponentProps<typeof CommandPrimitive>>) {
  return (
    <CommandPrimitive
      data-slot="command"
      className={cn(
        "flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground",
        className,
      )}
      {...props}
    />
  );
}

function CommandInput({
  className,
  ...props
}: Readonly<React.ComponentProps<typeof CommandPrimitive.Input>>) {
  return (
    <div className="flex items-center gap-2 border-b px-3">
      <span aria-hidden="true" className="text-muted-foreground text-sm">
        ⌕
      </span>
      <CommandPrimitive.Input
        data-slot="command-input"
        className={cn(
          "h-9 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
    </div>
  );
}

function CommandList({
  className,
  ...props
}: Readonly<React.ComponentProps<typeof CommandPrimitive.List>>) {
  return (
    <CommandPrimitive.List
      data-slot="command-list"
      className={cn(
        "max-h-64 overflow-x-hidden overflow-y-auto p-1",
        className,
      )}
      {...props}
    />
  );
}

function CommandEmpty({
  className,
  ...props
}: Readonly<React.ComponentProps<typeof CommandPrimitive.Empty>>) {
  return (
    <CommandPrimitive.Empty
      data-slot="command-empty"
      className={cn("px-3 py-6 text-center text-sm", className)}
      {...props}
    />
  );
}

function CommandGroup({
  className,
  ...props
}: Readonly<React.ComponentProps<typeof CommandPrimitive.Group>>) {
  return (
    <CommandPrimitive.Group
      data-slot="command-group"
      className={cn(
        "overflow-hidden [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

function CommandItem({
  className,
  ...props
}: Readonly<React.ComponentProps<typeof CommandPrimitive.Item>>) {
  return (
    <CommandPrimitive.Item
      data-slot="command-item"
      className={cn(
        "flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none select-none",
        "data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground",
        "data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
};
