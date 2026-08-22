"use client";

import { Button } from "@/components/ui/button";

interface PrintButtonProps {
  readonly label: string;
}

/**
 * Opens the browser's print dialog against this page (PRD FR-5.4). A plain
 * `<button>`, so it is reachable and activatable by keyboard like every other
 * control on the page (S1082) — `window.print()` needs no Enter-vs-Space
 * handling of its own beyond what a native button already gives it.
 */
export function PrintButton({ label }: Readonly<PrintButtonProps>) {
  return (
    <Button type="button" onClick={() => window.print()}>
      {label}
    </Button>
  );
}
