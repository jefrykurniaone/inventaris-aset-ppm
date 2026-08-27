import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RequiredMarker } from "./RequiredMarker";

/**
 * Rendered through `react-dom/server` rather than a DOM testing library: this
 * suite runs in Vitest's `node` environment with no jsdom, and the markup is
 * the whole behaviour of this component — what it emits, and when it emits
 * nothing at all.
 *
 * Written with `createElement` rather than JSX so this file stays a plain
 * `.ts`, matching every other test in the suite. The component it imports is
 * still `.tsx`, which is what `oxc.jsx` in `vitest.config.mts` is there for.
 */
function renderMarker(isMarkedRequired?: boolean): string {
  return renderToStaticMarkup(
    createElement(RequiredMarker, { isMarkedRequired }),
  );
}

describe("RequiredMarker", () => {
  it("renders nothing for a field that is not marked required", () => {
    expect(renderMarker(false)).toBe("");
  });

  it("renders nothing when the caller passes no decision at all", () => {
    expect(renderMarker()).toBe("");
  });

  it("renders an asterisk for a marked field", () => {
    expect(renderMarker(true)).toContain("*");
  });

  it("hides the asterisk from assistive technology", () => {
    expect(renderMarker(true)).toContain('aria-hidden="true"');
  });

  it("colours the asterisk with the destructive text token, not the surface one", () => {
    const markup = renderMarker(true);

    expect(markup).toContain("text-destructive-text");
  });

  it("adds no tab stop", () => {
    expect(renderMarker(true)).not.toContain("tabindex");
  });
});
