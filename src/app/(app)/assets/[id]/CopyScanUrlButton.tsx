"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

const COPIED_LABEL_DURATION_MS = 2000;

interface CopyScanUrlButtonProps {
  readonly scanUrl: string;
  readonly copyLabel: string;
  readonly copiedLabel: string;
}

/**
 * Copies the public scan URL to the clipboard (PRD FR-5.1: staff can see and
 * share what a scanner would see). The confirmation is the button's own text
 * changing, not a colour change alone — issue #10's accessibility
 * constraint — and it is announced to assistive technology via `aria-live`
 * on the button itself, since a button's accessible name update is not
 * otherwise guaranteed to be announced.
 */
export function CopyScanUrlButton({
  scanUrl,
  copyLabel,
  copiedLabel,
}: Readonly<CopyScanUrlButtonProps>) {
  const [isCopied, setIsCopied] = useState(false);

  async function handleCopy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(scanUrl);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), COPIED_LABEL_DURATION_MS);
    } catch (error) {
      // The clipboard API can refuse for reasons outside this component's
      // control (no permission, no secure context). The URL is already
      // visible as text and as a link, so a failed copy leaves the user
      // with a manual fallback rather than a broken feature.
      console.error("CopyScanUrlButton: failed to write to clipboard", {
        scanUrl,
        error,
      });
    }
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
      <span aria-live="polite">{isCopied ? copiedLabel : copyLabel}</span>
    </Button>
  );
}
