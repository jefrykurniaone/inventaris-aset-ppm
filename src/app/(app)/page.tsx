import { getTranslations } from "next-intl/server";

/**
 * Placeholder home page, now nested under the `(app)` route group and so
 * protected by `src/app/(app)/layout.tsx`'s `requireUser()` (PRD FR-1.5).
 * No product UI ships in this ticket; the only job here is to prove the
 * Tailwind + shadcn token layer renders in both themes, and that every
 * string on the page — including this demo copy — goes through `next-intl`
 * rather than being hardcoded.
 *
 * Wrapped in a `<div>` rather than a `<main>`: the shell layout already
 * renders the page's one `<main>` element, so this content is that
 * element's child, not a second one.
 */

interface ThemeCardProps {
  readonly label: string;
  readonly wrapperClassName: string;
  readonly description: string;
  readonly accentOnSurface: string;
  readonly accentAsText: string;
}

function ThemeCard({
  label,
  wrapperClassName,
  description,
  accentOnSurface,
  accentAsText,
}: Readonly<ThemeCardProps>) {
  return (
    <div className={wrapperClassName}>
      <section className="bg-background text-foreground border-border rounded-lg border p-5">
        <h2 className="text-sm font-medium tracking-wide uppercase">{label}</h2>
        <p className="text-muted-foreground mt-1 text-sm">{description}</p>
        <p className="bg-primary text-primary-foreground mt-4 rounded-md px-3 py-2 text-sm font-medium">
          {accentOnSurface}
        </p>
        <p className="text-primary mt-3 text-sm font-medium">{accentAsText}</p>
      </section>
    </div>
  );
}

export default async function HomePage() {
  const t = await getTranslations("HomePage");
  const sharedCardText = {
    description: t("themeDescription"),
    accentOnSurface: t("accentOnSurface"),
    accentAsText: t("accentAsText"),
  };
  const themePreviews = [
    { id: "light", label: t("themeLight"), wrapperClassName: "" },
    { id: "dark", label: t("themeDark"), wrapperClassName: "dark" },
  ];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground mt-2 text-sm">{t("subtitle")}</p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2">
        {themePreviews.map((preview) => (
          <ThemeCard
            key={preview.id}
            label={preview.label}
            wrapperClassName={preview.wrapperClassName}
            {...sharedCardText}
          />
        ))}
      </div>
    </div>
  );
}
