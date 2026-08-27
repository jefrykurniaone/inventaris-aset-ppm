import type { ReactNode } from "react";

interface HiddenSearchParamsProps {
  readonly params: URLSearchParams;
}

/**
 * One `<input type="hidden">` per query-string entry, so a plain `GET` form
 * can carry the view a visitor is already looking at.
 *
 * Every sort header and page-size control in this application is a `GET`
 * form rather than a link, which is what gives each of them a real
 * `<button>` a keyboard reaches without any client-side JavaScript. A `GET`
 * form replaces the action URL's query string wholesale, so whatever is not
 * a field is dropped — these hidden fields are what stop applying a filter
 * from silently resetting the sort, or changing the page size from dropping
 * the filters.
 *
 * The params come from each list's own serialiser, which already omits every
 * value equal to its default, so nothing here writes a default back into the
 * URL.
 */
export function HiddenSearchParams({
  params,
}: Readonly<HiddenSearchParamsProps>): ReactNode {
  return Array.from(params).map(([name, value]) => (
    <input key={`${name}=${value}`} type="hidden" name={name} value={value} />
  ));
}
