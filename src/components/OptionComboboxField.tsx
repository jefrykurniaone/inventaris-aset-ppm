"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { FieldError } from "@/components/FieldError";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  findComboboxOption,
  groupComboboxOptions,
  matchesComboboxSearch,
  type ComboboxOption,
  type ComboboxOptionGroup,
} from "@/lib/combobox-options";
import { cn } from "@/lib/utils";

/**
 * One labelled, searchable picker — issue #88's replacement for the native
 * `<select>` on the room and category fields, used unchanged by both the asset
 * write form and the asset list's filter form. One component rather than one
 * per form: the two differ only in the props they pass.
 *
 * It is not a `<select>`, so it submits nothing by itself. The chosen id
 * travels in a hidden input carrying the field's `name` — the same device
 * `AssetSelectField` already uses for a locked `status` — which keeps the
 * filter form a plain `GET` round-trip producing the query string the native
 * selects produced.
 *
 * Keyboard operation is the two libraries', not this file's: cmdk owns the
 * input's `role="combobox"`, the listbox, the options and the arrow keys
 * between them; Radix Popover owns Escape, the outside click, and returning
 * focus to the trigger.
 */

interface OptionComboboxFieldProps {
  readonly id: string;
  readonly name: string;
  readonly label: string;
  /** Shown while nothing is chosen: "Select a room" on the write form, "All
   * rooms" on the list filter. */
  readonly placeholder: string;
  readonly options: readonly ComboboxOption[];
  readonly defaultValue: string;
  /** A required field offers no clear-selection row; an optional one does, and
   * clearing it submits the empty string the native `<select>` used to. */
  readonly isRequired?: boolean;
  readonly error?: string;
}

/** cmdk scores every item and keeps the highest; a plain yes/no is all this
 * picker needs, and equal scores leave the caller's ordering intact. */
const MATCH_SCORE = 1;
const NO_MATCH = 0;

/** Marks the option currently chosen, alongside `aria-current`. A text glyph
 * rather than an icon dependency — the same choice `SortableColumnHeader`
 * makes for its sort arrows. */
const SELECTED_MARK = "✓";
const OPEN_MARK = "▾";

/** The clear-selection row's cmdk value. It cannot collide with a real option:
 * every option's value is a database id. */
const CLEAR_ITEM_VALUE = "combobox-clear-selection";

/**
 * cmdk's filter, delegated to this project's own matcher.
 *
 * The `value` argument is deliberately ignored: it is the option's database id,
 * and cmdk's default scoring would match a random id as a subsequence of
 * almost any short query. The label rides in `keywords` instead — see
 * `matchesComboboxSearch`.
 */
function filterByKeywords(
  _value: string,
  search: string,
  keywords?: string[],
): number {
  const label = keywords?.join(" ") ?? "";
  return matchesComboboxSearch(label, search) ? MATCH_SCORE : NO_MATCH;
}

interface ComboboxItemProps {
  readonly option: ComboboxOption;
  readonly isSelected: boolean;
  readonly onSelect: (id: string) => void;
}

/** `aria-current` rather than `aria-selected` for the chosen option: cmdk uses
 * `aria-selected` for the option the arrow keys are currently on, which is a
 * different fact and would otherwise be announced for both. */
function ComboboxItem({
  option,
  isSelected,
  onSelect,
}: Readonly<ComboboxItemProps>) {
  return (
    <CommandItem
      value={option.id}
      keywords={[option.label]}
      aria-current={isSelected ? "true" : undefined}
      onSelect={() => onSelect(option.id)}
    >
      <span aria-hidden="true" className="w-3 shrink-0 text-center">
        {isSelected ? SELECTED_MARK : ""}
      </span>
      <span>{option.label}</span>
    </CommandItem>
  );
}

interface ComboboxClearItemProps {
  readonly label: string;
  readonly onSelect: (id: string) => void;
}

/** Returns an optional field to "nothing chosen" — the empty string every
 * caller's schema already reads as absent. A row in the listbox rather than a
 * second button beside the trigger, so it is reached by the same arrow keys
 * as every other choice. */
function ComboboxClearItem({
  label,
  onSelect,
}: Readonly<ComboboxClearItemProps>) {
  return (
    <CommandItem
      value={CLEAR_ITEM_VALUE}
      keywords={[label]}
      onSelect={() => onSelect("")}
    >
      <span aria-hidden="true" className="w-3 shrink-0 text-center" />
      <span>{label}</span>
    </CommandItem>
  );
}

interface ComboboxGroupBlockProps {
  readonly group: ComboboxOptionGroup;
  readonly selectedId: string;
  readonly onSelect: (id: string) => void;
}

/** One heading and the options under it. A real `cmdk` group, so the rooms
 * picker's grouping by building is in the accessibility tree rather than
 * implied by the building code each label starts with. */
function ComboboxGroupBlock({
  group,
  selectedId,
  onSelect,
}: Readonly<ComboboxGroupBlockProps>) {
  return (
    <CommandGroup heading={group.heading ?? undefined}>
      {group.options.map((option) => (
        <ComboboxItem
          key={option.id}
          option={option}
          isSelected={option.id === selectedId}
          onSelect={onSelect}
        />
      ))}
    </CommandGroup>
  );
}

interface ComboboxPanelProps {
  readonly field: OptionComboboxFieldProps;
  readonly selectedId: string;
  readonly onSelect: (id: string) => void;
}

function ComboboxOptionList({
  field,
  selectedId,
  onSelect,
}: Readonly<ComboboxPanelProps>) {
  const t = useTranslations("Combobox");
  const isClearable = field.isRequired !== true && selectedId !== "";

  return (
    <Command label={field.label} filter={filterByKeywords} loop>
      <CommandInput placeholder={t("searchPlaceholder")} />
      <CommandList label={field.label}>
        <CommandEmpty>{t("noResults")}</CommandEmpty>
        {isClearable && (
          <ComboboxClearItem label={t("clearSelection")} onSelect={onSelect} />
        )}
        {groupComboboxOptions(field.options).map((group, index) => (
          <ComboboxGroupBlock
            key={`${group.heading ?? ""}-${index}`}
            group={group}
            selectedId={selectedId}
            onSelect={onSelect}
          />
        ))}
      </CommandList>
    </Command>
  );
}

interface ComboboxTriggerProps {
  readonly field: OptionComboboxFieldProps;
  readonly labelId: string;
  readonly errorId: string;
  readonly selectedId: string;
}

/**
 * The closed picker.
 *
 * `role="combobox"` with `aria-required` is the select-only combobox the
 * WAI-ARIA practices describe, and the one role this component adds: no native
 * element opens a searchable list, so there is nothing semantic to prefer over
 * it. `aria-labelledby` names the button with its own `<label>` *and* its own
 * contents, so the field and the current choice are announced together. Radix
 * supplies `aria-expanded`, `aria-controls` and `aria-haspopup`.
 */
function ComboboxTrigger({
  field,
  labelId,
  errorId,
  selectedId,
}: Readonly<ComboboxTriggerProps>) {
  const selected = findComboboxOption(field.options, selectedId);
  const hasError = Boolean(field.error);

  return (
    <PopoverTrigger asChild>
      <Button
        id={field.id}
        type="button"
        variant="outline"
        role="combobox"
        aria-labelledby={`${labelId} ${field.id}`}
        aria-required={field.isRequired || undefined}
        aria-invalid={hasError}
        aria-describedby={hasError ? errorId : undefined}
        className={cn(
          "w-full justify-between font-normal",
          !selected && "text-muted-foreground",
        )}
      >
        <span className="truncate">{selected?.label ?? field.placeholder}</span>
        <span aria-hidden="true">{OPEN_MARK}</span>
      </Button>
    </PopoverTrigger>
  );
}

export function OptionComboboxField(field: Readonly<OptionComboboxFieldProps>) {
  const [selectedId, setSelectedId] = useState(field.defaultValue);
  const [isOpen, setIsOpen] = useState(false);
  const labelId = `${field.id}-label`;
  const errorId = `${field.id}-error`;

  function handleSelect(nextId: string) {
    setSelectedId(nextId);
    setIsOpen(false);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label id={labelId} htmlFor={field.id}>
        {field.label}
      </Label>
      <input type="hidden" name={field.name} value={selectedId} />
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <ComboboxTrigger
          field={field}
          labelId={labelId}
          errorId={errorId}
          selectedId={selectedId}
        />
        <PopoverContent>
          <ComboboxOptionList
            field={field}
            selectedId={selectedId}
            onSelect={handleSelect}
          />
        </PopoverContent>
      </Popover>
      <FieldError id={errorId} message={field.error} />
    </div>
  );
}
