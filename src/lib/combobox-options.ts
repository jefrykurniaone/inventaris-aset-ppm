/**
 * The pure half of the searchable pickers (issue #88): what counts as a match
 * for a typed query, and how one flat option list becomes headed groups.
 *
 * Both live here rather than inside the component so that the matching rule is
 * a function with a test beside it rather than a behaviour only a browser can
 * observe.
 *
 * Why the combobox does not simply use cmdk's `defaultFilter`: that scores the
 * item's `value`, and every option value in this application is an opaque
 * database id. A random id matches most short queries as a subsequence, so
 * typing two letters would surface rooms that have nothing to do with them.
 * The combobox keeps the id as the value — it is what the form submits — and
 * hands the human-readable label to `matchesComboboxSearch` through cmdk's
 * `keywords`.
 */

/** One entry of a searchable picker. Structurally the `AssetOption` the asset
 * register already passes around, so no call site has to convert. */
export interface ComboboxOption {
  readonly id: string;
  readonly label: string;
  /** Heading this option is listed under, or absent for an ungrouped list.
   * The rooms picker groups by building (PRD FR-3.2). */
  readonly group?: string;
}

/** A run of consecutive options sharing one heading. `heading` is `null` for
 * options that declare no group. */
export interface ComboboxOptionGroup {
  readonly heading: string | null;
  readonly options: readonly ComboboxOption[];
}

/** Whitespace, for splitting a query into terms. A bounded character class
 * with a single quantifier — nothing to backtrack on (S5852, S8786). */
const WHITESPACE = /\s+/;

/**
 * Every whitespace-separated term of `search` appears somewhere in `label`,
 * ignoring case — so "a101 lab" finds "A101 — Lab Jaringan" and the order the
 * terms were typed in does not matter. An empty or whitespace-only search
 * matches everything, which is what makes an untouched picker show its whole
 * list.
 */
export function matchesComboboxSearch(label: string, search: string): boolean {
  const haystack = label.toLowerCase();
  const terms = search
    .toLowerCase()
    .split(WHITESPACE)
    .filter((term) => term.length > 0);

  return terms.every((term) => haystack.includes(term));
}

interface OpenGroup {
  heading: string | null;
  options: ComboboxOption[];
}

/**
 * Splits an option list into headed groups, preserving the order the caller
 * gave — the rooms query already orders by building code and then room code,
 * so consecutive rooms of one building fall into one group without this
 * function needing to sort anything.
 *
 * A group that reappears after another one starts a second block rather than
 * merging backwards. That keeps this a pure reading of the given order: if two
 * blocks ever appear, the ordering upstream is what changed.
 */
export function groupComboboxOptions(
  options: readonly ComboboxOption[],
): readonly ComboboxOptionGroup[] {
  const groups: OpenGroup[] = [];

  for (const option of options) {
    const heading = option.group ?? null;
    const openGroup = groups.at(-1);
    if (openGroup && openGroup.heading === heading) {
      openGroup.options.push(option);
      continue;
    }
    groups.push({ heading, options: [option] });
  }

  return groups;
}

/** The option a picker's current value points at, or `undefined` when nothing
 * is selected or the stored id is no longer in the list. */
export function findComboboxOption(
  options: readonly ComboboxOption[],
  id: string,
): ComboboxOption | undefined {
  if (id === "") {
    return undefined;
  }
  return options.find((option) => option.id === id);
}
