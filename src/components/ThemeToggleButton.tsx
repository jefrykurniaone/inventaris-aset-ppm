"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { setTheme } from "@/lib/set-theme";
import type { Theme } from "@/lib/theme";

/** Matches the class `src/app/globals.css`'s `@custom-variant dark` reads. */
const DARK_CLASS = "dark";

interface ThemeToggleButtonProps {
  readonly initialTheme: Theme;
  readonly labelToDark: string;
  readonly labelToLight: string;
}

/**
 * The interactive half of the theme toggle (see `src/components/ThemeToggle.tsx`
 * for the server half that resolves the initial theme and the labels). Split
 * the same way as `LocaleSwitcherSelect`, for the same reason: only this part
 * ships as client JavaScript.
 *
 * Toggling flips the `dark` class on `<html>` directly and immediately —
 * there is no client-side theme context to wait on — then persists the
 * choice with `setTheme` so the next full page load (or the next visit)
 * renders the same theme server-side, with no flash of the other one.
 */
export function ThemeToggleButton({
  initialTheme,
  labelToDark,
  labelToLight,
}: Readonly<ThemeToggleButtonProps>) {
  const [theme, setLocalTheme] = useState<Theme>(initialTheme);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    const nextTheme: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.classList.toggle(DARK_CLASS, nextTheme === "dark");
    setLocalTheme(nextTheme);
    startTransition(() => {
      void setTheme(nextTheme);
    });
  }

  const label = theme === "dark" ? labelToLight : labelToDark;

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={isPending}
      aria-busy={isPending}
    >
      {label}
    </Button>
  );
}
