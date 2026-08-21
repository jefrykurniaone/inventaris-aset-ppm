/**
 * Placeholder home page. No product UI ships in the scaffold ticket; the only
 * job here is to prove the Tailwind + shadcn token layer renders in both
 * themes. Strings are placeholders — every user-facing string moves behind
 * `next-intl` in the internationalisation ticket.
 */

type ThemePreview = Readonly<{
  id: string;
  label: string;
  wrapperClassName: string;
}>;

const THEME_PREVIEWS: readonly ThemePreview[] = [
  { id: "light", label: "Light", wrapperClassName: "" },
  { id: "dark", label: "Dark", wrapperClassName: "dark" },
];

function ThemeCard({ label, wrapperClassName }: ThemePreview) {
  return (
    <div className={wrapperClassName}>
      <section className="bg-background text-foreground border-border rounded-lg border p-5">
        <h2 className="text-sm font-medium tracking-wide uppercase">{label}</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Neutral base, Telkom University red accent.
        </p>
        <p className="bg-primary text-primary-foreground mt-4 rounded-md px-3 py-2 text-sm font-medium">
          Accent on surface
        </p>
        <p className="text-primary mt-3 text-sm font-medium">Accent as text</p>
      </section>
    </div>
  );
}

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center gap-8 p-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">
          Inventaris Aset PPM
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Scaffold placeholder. Product surfaces arrive with their own tickets.
        </p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2">
        {THEME_PREVIEWS.map((preview) => (
          <ThemeCard key={preview.id} {...preview} />
        ))}
      </div>
    </main>
  );
}
