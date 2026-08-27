import { useTranslations } from "next-intl";

/**
 * The line above a form's fields explaining what its asterisks mean.
 *
 * Rendered once per form and above the fields, so the explanation is read
 * before the markers it explains rather than after them.
 *
 * Not a `<legend>` despite the name: the `<fieldset>`s below already own that
 * element for their section headings, and this is a note about the form as a
 * whole, so it is a plain paragraph and adds no grouping to the accessibility
 * tree. It adds no tab stop either.
 *
 * Coloured with `--destructive-text` — the same token `RequiredMarker` uses.
 * The asterisk in this sentence is a sample of the thing being described, so it
 * has to look like it, and that token is the one asserted at 4.5:1 against
 * `--background` in both themes (issue #37). Unlike the markers this text is
 * *not* hidden from assistive technology: it is the explanation, and the
 * asterisk it quotes is part of the sentence.
 */
export function FormRequiredLegend() {
  const t = useTranslations("Forms");

  return (
    <p className="text-destructive-text text-sm">{t("requiredFieldLegend")}</p>
  );
}
