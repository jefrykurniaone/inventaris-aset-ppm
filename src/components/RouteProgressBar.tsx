"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

const PRIMARY_MOUSE_BUTTON = 0;
const PROGRESS_BAR_ACTIVE_CLASS = "w-2/3 opacity-100";
const PROGRESS_BAR_IDLE_CLASS = "w-full opacity-0";

/** Whether a click should start the bar: a plain, unmodified left click on an
 * in-app `<a>` whose target URL actually differs from the current one.
 * Modified clicks (new tab, download, a different origin) are left to the
 * browser's own handling, and a same-URL anchor is left alone too, so the
 * bar never starts for a navigation that was never going to finish. */
function isInAppNavigationClick(event: MouseEvent): boolean {
  if (event.defaultPrevented || event.button !== PRIMARY_MOUSE_BUTTON) {
    return false;
  }
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return false;
  }
  const target = event.target;
  if (!(target instanceof Element)) {
    return false;
  }
  const anchor = target.closest("a[href]");
  if (!(anchor instanceof HTMLAnchorElement)) {
    return false;
  }
  if (
    anchor.hasAttribute("download") ||
    (anchor.target && anchor.target !== "_self")
  ) {
    return false;
  }
  if (anchor.origin !== window.location.origin) {
    return false;
  }
  return (
    anchor.pathname !== window.location.pathname ||
    anchor.search !== window.location.search
  );
}

interface RouteProgressBarProps {
  readonly label: string;
}

/**
 * A hand-rolled top progress bar (ticket #84): App Router link navigations
 * are client-side fetches, so the browser's own tab spinner never runs for
 * them. A document-level click listener starts the bar the instant an
 * in-app link is clicked; `usePathname`/`useSearchParams` changing is the
 * signal the destination has actually rendered, which is what clears it —
 * the same start/stop pair a library like nprogress would use, without a
 * dependency for a few dozen lines of CSS and a click listener.
 *
 * Decorative only: the coloured bar itself is `aria-hidden`, and the loading
 * state is announced once, politely, by the adjacent `role="status"` text —
 * not continuously, so it never spams a screen reader across a single
 * navigation. Nothing here takes focus, so it never traps keyboard use.
 *
 * Mounted once in the root layout inside a `<Suspense>` boundary, which
 * `useSearchParams` requires (see Next.js's `missing-suspense-with-csr-bailout`
 * error) — every route, public and authenticated alike, gets the same
 * feedback.
 */
export function RouteProgressBar({ label }: Readonly<RouteProgressBarProps>) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isNavigating, setIsNavigating] = useState(false);
  const currentUrlRef = useRef(`${pathname}?${searchParams.toString()}`);

  useEffect(() => {
    const nextUrl = `${pathname}?${searchParams.toString()}`;
    if (currentUrlRef.current !== nextUrl) {
      currentUrlRef.current = nextUrl;
      setIsNavigating(false);
    }
  }, [pathname, searchParams]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (isInAppNavigationClick(event)) {
        setIsNavigating(true);
      }
    }
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, []);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 h-1">
      <div
        aria-hidden="true"
        className={cn(
          "bg-primary h-full transition-[width,opacity] duration-300 ease-out",
          isNavigating ? PROGRESS_BAR_ACTIVE_CLASS : PROGRESS_BAR_IDLE_CLASS,
        )}
      />
      <span role="status" className="sr-only">
        {isNavigating ? label : ""}
      </span>
    </div>
  );
}
