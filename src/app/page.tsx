import { getTranslations } from "next-intl/server";

/**
 * Placeholder home page. No product UI ships in this ticket; the only job
 * here is to prove the Tailwind + shadcn token layer renders in both
 * themes, and that every string on the page — including this demo
 * copy — goes through `next-intl` rather than being hardcoded.
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
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center gap-8 p-8">
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
    </main>
  );
}
