import { buildLabelSheetCss } from "@/lib/label-sheet";

const LABEL_SHEET_CSS = buildLabelSheetCss();

/**
 * The print stylesheet for the label sheet (PRD FR-5.4), rendered as a plain
 * `<style>` child rather than `dangerouslySetInnerHTML`: `buildLabelSheetCss`
 * builds its output entirely from `LABEL_SHEET`'s numbers, never from a
 * request or the database, so there is nothing here for an escape hatch to
 * protect against — the same reasoning `QrCode.tsx` gives for building its
 * own markup as elements instead of a string handed to one.
 */
export function LabelSheetStyle() {
  return <style>{LABEL_SHEET_CSS}</style>;
}
